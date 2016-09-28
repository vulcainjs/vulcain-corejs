import { RequestContext } from './../servers/requestContext';
import { Conventions } from './../utils/conventions';
import * as passportStrategy from 'passport-strategy';

export class ApiKeyStrategy extends passportStrategy.Strategy {

    name: string;
    private _verify: Function;
    private _passReqToCallback: boolean;

  constructor(options: any, verify?: Function)
  {
        if (typeof options == 'function') {
            verify = options;
            options = {};
        }
        if (!verify) {
            throw new TypeError('ApiKeyStrategy requires a verify callback');
        }

        super();

        this.name = 'apiKey';
        this._verify = verify;
        this._passReqToCallback = options.passReqToCallback;
    }

    /**
     * Authenticate request based on the contents of a HTTP Basic authorization
     * header.
     *
     * @param {Object} req
     * @api protected
     */
    authenticate(req) {
        var authorization = req.headers['authorization'];
        if (!authorization) { return this.success(false, null); }

        var parts = authorization.split(' ')
        if (parts.length < 2) { return this.fail(400); }

        var scheme = parts[0]
        , apiKey = parts[1];

        if (!/ApiKey/i.test(scheme)) { return this.fail(null); }
        if (!apiKey) { return this.fail(null); }

        var self = this;

        function verified(err, user, info) {
            if (err) { return self.error(err); }
            if (!user) { return self.fail(null); }
            self.success(user, info);
        }

        let params = {apiKey, tenant: req.headers["X_VULCAIN_TENANT"] || process.env[Conventions.ENV_TENANT] || RequestContext.TestTenant}
        if (self._passReqToCallback) {
            this._verify(req, params, verified);
        } else {
            this._verify(params, verified);
        }
    }
}