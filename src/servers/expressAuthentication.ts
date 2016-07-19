
var passport = require('passport');
import passportStrategy = require('passport-strategy');
var BearerStrategy = require('passport-http-bearer').Strategy
import {Injectable, Inject, LifeTime} from '../di/annotations';
import {ITokenService} from '../defaults/services';
const AnonymousStrategy = require('passport-anonymous');

@Injectable("Authentication", LifeTime.Singleton)
export class Authentication
{
    constructor(  @Inject("TokenService")tokens:ITokenService )
    {
        this.initBearer(tokens);
        passport.use(new AnonymousStrategy());
    }

    private initBearer( tokens:ITokenService )
    {
        let strategy = new BearerStrategy( async ( accessToken, callback ) =>
        {
            try
            {
                let token = await (<any>tokens).verifyTokenAsync(accessToken );

                // No token found
                if( !token )
                {
                    return callback( null, false );
                }

                token.user.scopes= token.scopes
                callback(null, token.user);
            }
            catch( err )
            {
                return callback( null, false );
            }
        });

        // Workaround to remove Basic realm header to avoid a browser popup
        strategy._challenge = ()=>null;

        passport.use( strategy );
    }

    init() {return passport.authenticate( ['bearer', 'anonymous'], { session: false } );}
}










