import { Inject, DefaultServiceNames } from '../../di/annotations';
import { ITokenService } from '../../defaults/services';
import { System } from '../../configurations/globals/system';
import { RequestContext, UserContext } from '../requestContext';
import * as express from 'express';

export class ExpressAuthentication {
    static readonly Anonymous: UserContext = { id: "_anonymous", name: "anonymous", scopes: [], tenant: null };

    private strategies = new Map<string, (ctx: RequestContext, token: string) => Promise<UserContext>>();

    constructor( ) {
        this.addOrReplaceStrategy('bearer', this.bearerAuthentication);
        this.addOrReplaceStrategy('apikey', this.apiKeyAuthentication);
    }

    addOrReplaceStrategy(name: string, verify: (ctx: RequestContext, token: string) => Promise<UserContext>) {
        this.strategies.set(name, verify);
    }

    private async bearerAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let tokens = ctx.container.get<ITokenService>("TokenService");
            let token = await tokens.verifyTokenAsync({ token: accessToken, tenant: ctx.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, "Bearer authentication: Invalid jwtToken : " + accessToken);
                return null;
            }

            token.user.tenant = token.user.tenant || token.tenantId;
            token.user.scopes = token.scopes;
            token.user.data = token.user.data || token.data;
            token.user.bearer = accessToken;

            return token.user;
        }
        catch (err) {
            System.log.error(ctx, err, "Bearer authentication: Error with jwtToken " + accessToken);
            return null;
        }
    }

    private async apiKeyAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let apiKeys = ctx.container.get<ITokenService>("ApiKeyService", true);
            if (!apiKeys)
                return null;
            let token = await apiKeys.verifyTokenAsync({ token: accessToken, tenant: ctx.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, `ApiKey authentication: Invalid apiKey ${accessToken} for tenant ${ctx.tenant}`);
                return null;
            }

            token.user.data = token.user.data || token.data;
            token.user.scopes = Array.isArray(token.token.scopes) ? token.token.scopes : [<string>token.token.scopes];
            return token.user;
        }
        catch (err) {
            System.log.error(ctx, err, `ApiKey authentication: Error with apiKey ${accessToken} for tenant ${ctx.tenant}`);
            throw err;
        }
    }

    init(testUser: UserContext) {
        return async (req, res: express.Response, next) => {
            let ctx: RequestContext = req.requestContext;
            let authorization = req.headers['authorization'];
            // Perhaps in cookies
            if (!authorization)
                authorization = req.cookies && req.cookies.Authorization;

            if (!authorization) {
                // Force test user only if there is no authorization
                if (testUser) {
                    ctx.user = testUser;
                    ctx.tenant = ctx.tenant || ctx.user.tenant;
                    System.log.info(ctx, `Request context - force test user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.tenant}`);
                }
                next();
                return;
            }

            try {
                let parts = authorization.split(' ');
                if (parts.length < 2) {
                    throw new Error("Invalid authorization header : " + authorization);
                }

                let scheme = parts[0], token = parts[1];
                for (let [strategyName, verify] of this.strategies) {
                    if (!scheme || scheme.substr(0, strategyName.length).toLowerCase() !== strategyName)
                        continue;
                    if (!token) { throw new Error("Invalid authorization header."); }

                    let user = await verify(ctx, token);
                    if (user) {
                        ctx.user = user;
                        if (ctx.user.tenant) {
                            ctx.tenant = ctx.user.tenant;
                        }
                        else {
                            ctx.user.tenant = ctx.tenant;
                        }
                        // For context propagation
                        if (strategyName === "bearer")
                            ctx.bearer = token;
                        next();
                        return;
                    }
                }
            }
            catch (err) {
                ctx.logError(err, "Authentication error");
            }

            res.status(401);
            res.send();
        };
    };
}










