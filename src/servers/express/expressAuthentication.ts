import { Inject, DefaultServiceNames } from '../../di/annotations';
import { ITokenService } from '../../defaults/services';
import { System } from '../../configurations/globals/system';
import { RequestContext, UserContext } from '../requestContext';
import * as express from 'express';
import { AbstractExpressAuthentication } from './abstractExpressAuthentication';

export class ExpressAuthentication extends AbstractExpressAuthentication {

    constructor() {
        super();
        this.addOrReplaceStrategy('bearer', this.bearerAuthentication);
        this.addOrReplaceStrategy('apikey', this.apiKeyAuthentication);
    }

    private async bearerAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let tokens = ctx.container.get<ITokenService>(DefaultServiceNames.TokenService);
            let token = await tokens.verifyTokenAsync({ token: accessToken, tenant: ctx.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, ()=> `Bearer authentication: Invalid jwtToken : ${accessToken}`);
                return null;
            }

            if(!token.user) {
                token.user = {};
            }

            token.user.tenant = token.user.tenant || token.tenantId;
            token.user.scopes = token.scopes;
            token.user.data = token.user.data || token.data;
            token.user.bearer = accessToken; // Must be set by the bearer authentication

            return token.user; // Return the current user with its scopes and tenant
        }
        catch (err) {
            System.log.error(ctx, err, ()=> `Bearer authentication: Error with jwtToken ${accessToken}`);
            return null;
        }
    }

    private async apiKeyAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let apiKeys = ctx.container.get<ITokenService>(DefaultServiceNames.ApiKeyService, true);
            if (!apiKeys) {
                System.log.info(ctx, ()=> `ApiKey authentication ERROR: Apikey is not enabled. Use enableApiKeyAuthentication in application.ts.`);
                return null;
            }
            let token = await apiKeys.verifyTokenAsync({ token: accessToken, tenant: ctx.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, ()=> `ApiKey authentication: Invalid apiKey ${accessToken} for tenant ${ctx.tenant}`);
                return null;
            }

            token.user.data = token.user.data || token.data;
            token.user.scopes = Array.isArray(token.token.scopes) ? token.token.scopes : [<string>token.token.scopes];
           // token.user.tenant = token.token.tenant; TODO
            return token.user;
        }
        catch (err) {
            System.log.error(ctx, err, ()=> `ApiKey authentication: Error with apiKey ${accessToken} for tenant ${ctx.tenant}`);
            throw err;
        }
    }
}
