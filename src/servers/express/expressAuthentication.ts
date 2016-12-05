import { Inject } from '../../di/annotations';
import { ITokenService } from '../../defaults/services';
import { AuthenticationStrategies } from './auth/authenticationStrategies';
const passport = require('passport');

export class ExpressAuthentication {
    private strategies = ['bearer', 'anonymous'];

    constructor( @Inject("ApiKeyService", true) apiKeys: ITokenService) {
        if (apiKeys) {
            AuthenticationStrategies.initApiKey();
            this.strategies.unshift('apiKey'); // add apiKey as authentication strategies
        }
        AuthenticationStrategies.initBearer();
        AuthenticationStrategies.initAnonymous();
    }

    init() { return passport.authenticate(this.strategies, { session: false }); }
}










