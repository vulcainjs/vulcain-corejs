import { RequestContext } from './../servers/requestContext';
import { Conventions } from './../utils/conventions';
import * as passportStrategy from 'passport-strategy';

export class BearerStrategy extends passportStrategy.Strategy {

    name: string;
    private _verify: Function;

  constructor(verify: Function)
  {
        if (!verify) {
            throw new TypeError('BearerStrategy requires a verify callback');
        }

        super();

        this.name = 'bearer';
        this._verify = verify;
    }

    /**
     * Authenticate request based on the contents of a HTTP Basic authorization
     * header.
     *
     * @param {Object} req
     * @api protected
     */
    authenticate(req) {
        let authorization = req.headers['authorization'];
        // Perhaps in cookies
        if (!authorization)
            authorization = req.cookies && req.cookies.authorization;

        if (!authorization) { return this.success(false, null); }

        let parts = authorization.split(' ')
        if (parts.length < 2) { return this.fail(400); }

        let scheme = parts[0]
        , apiKey = parts[1];

        if (!/^Bearer$/i.test(scheme)) { return this.fail(null); }
        if (!apiKey) { return this.fail(null); }

        let self = this;

        function verified(err, user, info) {
            if (err) { return self.error(err); }
            if (!user) { return self.fail(null); }
            self.success(user, info);
        }

        let params = {apiKey, tenant: req.headers["X_VULCAIN_TENANT"] || process.env[Conventions.instance.ENV_TENANT] || RequestContext.TestTenant}
        this._verify(params, verified);
    }
}