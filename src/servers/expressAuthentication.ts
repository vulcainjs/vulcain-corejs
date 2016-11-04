import { Inject } from '../di/annotations';
import { ITokenService } from '../defaults/services';
import { AuthenticationStrategies } from '../auth/authenticationStrategies';
const passport = require('passport');

export class Authentication {
    private strategies = ['bearer', 'anonymous'];

    constructor( @Inject("TokenService") tokens: ITokenService, @Inject("ApiKeyService", true) apiKeys: ITokenService) {
        if (apiKeys) {
            AuthenticationStrategies.initApiKey(apiKeys);
            this.strategies.unshift('apiKey'); // add apiKey as authentication strategies
        }
        AuthenticationStrategies.initBearer(tokens);
        AuthenticationStrategies.initAnonymous();
    }

    init() { return passport.authenticate(this.strategies, { session: false }); }
}










