import { ApiKeyStrategy } from './apiKeyStrategy';
import { ITokenService } from '../defaults/services';
import { BearerStrategy } from './bearerStrategy';
import { IContainer } from '../di/resolvers';
import { RequestContext } from '../servers/requestContext';
const passport = require('passport');
const AnonymousStrategy = require('passport-anonymous');

export class AuthenticationStrategies {

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
                let token = await tokens.verifyTokenAsync( accessToken );

                // No token found
                if( !token )
                {
                    return callback( null, false );
                }

                token.user.tenant = token.user.tenant || token.tenantId;
                token.user.scopes = token.scopes;
                token.user.data = token.user.data || token.data;
                callback(null, token.user);
            }
            catch( err )
            {
                return callback( null, false );
            }
        });

        passport.use( strategy );
    }

    static initApiKey( )
    {
        let strategy = new ApiKeyStrategy( async ( params, callback, ctx: RequestContext ) =>
        {
            try
            {
                let apiKeys = ctx.container.get<ITokenService>("ApiKeyService");
                let token = await apiKeys.verifyTokenAsync( params );

                // No token found
                if( !token )
                {
                    return callback( null, false );
                }

                token.user.data = token.user.data || token.data;
                token.user.scopes = Array.isArray(token.token.scopes) ? token.token.scopes : [<string>token.token.scopes];
                callback(null, token.user);
            }
            catch( err )
            {
                return callback( null, false );
            }
        });

        passport.use( strategy );
    }
}