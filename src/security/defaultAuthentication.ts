import { RequestContext } from "../pipeline/requestContext";
import { DefaultServiceNames, Inject } from "../di/annotations";
import { System } from "../configurations/globals/system";
import { SecurityManager, ITokenService } from "./securityManager";
import { IAuthorizationPolicy } from "./authorizationPolicy";
import { UnauthorizedRequestError } from "../pipeline/errors/applicationRequestError";

export class DefaultAuthentication extends SecurityManager {

    constructor(@Inject(DefaultServiceNames.AuthorizationPolicy) scopePolicy: IAuthorizationPolicy) {
        super(scopePolicy);
        this.addOrReplaceStrategy('bearer', this.bearerAuthentication.bind(this));
        this.addOrReplaceStrategy('apikey', this.apiKeyAuthentication.bind(this));
    }

    private async bearerAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let tokens = ctx.container.get<ITokenService>(DefaultServiceNames.TokenService);
            let userContext = await tokens.verifyTokenAsync({ token: accessToken, tenant: ctx.security.tenant });

            // No token found
            if (!userContext) {
                System.log.info(ctx, ()=> `Bearer authentication: Invalid jwtToken : ${accessToken}`);
                throw new UnauthorizedRequestError();
            }

            userContext.bearer = accessToken; // Must be set by the bearer authentication

            return userContext; // Return the current user with its scopes and tenant
        }
        catch (err) {
            System.log.error(ctx, err, ()=> `Bearer authentication: Error with jwtToken ${accessToken}`);
            throw new UnauthorizedRequestError();
        }
    }

    private async apiKeyAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let apiKeys = ctx.container.get<ITokenService>(DefaultServiceNames.ApiKeyService, true);
            if (!apiKeys) {
                System.log.info(ctx, ()=> `ApiKey authentication ERROR: Apikey is not enabled. Use enableApiKeyAuthentication in application.ts.`);
                return null;
            }
            let token = await apiKeys.verifyTokenAsync({ token: accessToken, tenant: ctx.security.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, ()=> `ApiKey authentication: Invalid apiKey ${accessToken} for tenant ${ctx.security.tenant}`);
                throw new UnauthorizedRequestError();
            }

            token.scopes = Array.isArray(token.scopes) ? token.scopes : [<string>token.scopes];
            return token;
        }
        catch (err) {
            System.log.error(ctx, err, ()=> `ApiKey authentication: Error with apiKey ${accessToken} for tenant ${ctx.security.tenant}`);
            throw new UnauthorizedRequestError();
        }
    }
}