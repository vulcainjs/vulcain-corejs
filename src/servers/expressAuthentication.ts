import {Injectable, Inject, LifeTime} from '../di/annotations';
import {ITokenService} from '../defaults/services';
import {AuthenticationStrategies} from '../auth/authenticationStrategies';
const AnonymousStrategy = require('passport-anonymous');
const passport = require('passport');

@Injectable(LifeTime.Singleton)
export class Authentication
{
    private strategies = ['bearer', 'anonymous'];

    constructor( @Inject("TokenService")tokens:ITokenService, @Inject("ApiKeyService", true)apiKeys:ITokenService )
    {
        if (apiKeys) {
            AuthenticationStrategies.initBearer(apiKeys);
            this.strategies.unshift('apiKey');
        }
        AuthenticationStrategies.initBearer(tokens);
        passport.use(new AnonymousStrategy());
    }

    init() {return passport.authenticate(this.strategies , { session: false } );}
}










