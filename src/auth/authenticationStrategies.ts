import { ApiKeyStrategy } from './apiKeyStrategy';
import { ITokenService, VerifyTokenParameter } from '../defaults/services';
import { BearerStrategy } from './bearerStrategy';
import { RequestContext } from '../servers/requestContext';
import { System } from '../configurations/globals/system';
import { UserContext } from '../servers/requestContext';
const passport = require('passport');
const AnonymousStrategy = require('passport-anonymous');

export class AuthenticationStrategies {

    static readonly Anonymous: UserContext = { id: "_anonymous", name: "anonymous", scopes: [], tenant: null };

    static initAnonymous() {
        passport.use(new AnonymousStrategy());
    }

    static initBearer()
    {
        let strategy = new BearerStrategy( async ( accessToken, callback, ctx: RequestContext ) =>
        {
            try
            {
                let tokens = ctx.container.get<ITokenService>("TokenService");
                let token = await tokens.verifyTokenAsync({ token: accessToken, tenant: ctx.tenant } );

                // No token found
                if( !token )
                {
                    System.log.info(ctx, "Bearer authentication: Invalid jwtToken : " + accessToken);
                    return callback( null, false );
                }

                token.user.tenant = token.user.tenant || token.tenantId;
                token.user.scopes = token.scopes;
                token.user.data = token.user.data || token.data;
                token.user.bearer = accessToken;

                callback(null, token.user);
            }
            catch( err )
            {
                System.log.error(ctx, err, "Bearer authentication: Error with jwtToken " + accessToken);
                return callback( null, false );
            }
        });

        passport.use( strategy );
    }

    static initApiKey( )
    {
        let strategy = new ApiKeyStrategy( async ( params: VerifyTokenParameter, callback, ctx: RequestContext ) =>
        {
            try
            {
                let apiKeys = ctx.container.get<ITokenService>("ApiKeyService");
                let token = await apiKeys.verifyTokenAsync( params );

                // No token found
                if( !token )
                {
                    System.log.info(ctx, `ApiKey authentication: Invalid apiKey ${params.token} for tenant ${params.tenant}`);
                    return callback( null, false );
                }

                token.user.data = token.user.data || token.data;
                token.user.scopes = Array.isArray(token.token.scopes) ? token.token.scopes : [<string>token.token.scopes];
                callback(null, token.user);
            }
            catch( err )
            {
                System.log.error(ctx, err, `ApiKey authentication: Error with apiKey ${params.token} for tenant ${params.tenant}`);
                return callback( null, false );
            }
        });

        passport.use( strategy );
    }
}