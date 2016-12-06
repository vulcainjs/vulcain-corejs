import { ITokenService, VerifyTokenParameter } from '../../../defaults/services';
import { RequestContext } from '../../../servers/requestContext';
import { System } from '../../../configurations/globals/system';
import { UserContext } from '../../../servers/requestContext';
import { TokenService } from '../../../defaults/services/tokenService';

export class AuthenticationStrategies {

    static readonly Anonymous: UserContext = { id: "_anonymous", name: "anonymous", scopes: [], tenant: null };

    static async bearerAuthentication(ctx: RequestContext, accessToken: string) {
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

    static async apiKeyAuthentication(ctx: RequestContext, accessToken: string) {
        try {
            let apiKeys = ctx.container.get<ITokenService>("ApiKeyService");
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
            return null;
        }
    }
}