import {Injectable, Inject, LifeTime} from '../di/annotations';
import {ITokenService} from '../defaults/services';
import {AuthenticationStrategies} from '../auth/authenticationStrategies';
const AnonymousStrategy = require('passport-anonymous');
const passport = require('passport');

@Injectable(LifeTime.Singleton)
export class Authentication
{
    constructor( @Inject("TokenService")tokens:ITokenService, @Inject("ApiKeyService", true)apiKeys:ITokenService )
    {
        if(apiKeys)
            AuthenticationStrategies.initBearer(apiKeys);
        AuthenticationStrategies.initBearer(tokens);
        passport.use(new AnonymousStrategy());
    }

    init() {return passport.authenticate( ['apiKey', 'bearer', 'anonymous'], { session: false } );}
}










