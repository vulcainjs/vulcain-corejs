import { IAuthorizationPolicy } from './authorizationPolicy';
import { Service } from "../globals/system";
import { RequestContext } from "../pipeline/requestContext";
import { ApplicationError, UnauthorizedRequestError } from "../pipeline/errors/applicationRequestError";
import { VulcainLogger } from "../log/vulcainLogger";
import { DefaultServiceNames, Inject } from "../di/annotations";
import { IContainer } from '../di/resolvers';
import { IRequestContext } from '../pipeline/common';
import { TokenService } from './services/tokenService';

export interface IAuthenticationStrategy {
    name: string;
    verifyToken(ctx: IRequestContext, token: string, tenant: string): Promise<UserContextData>;
    createToken?(user: UserContextData): Promise<{ expiresIn: number, token: string, renewToken: string }>;
}

export interface UserContextData {
    /**
     * User name
     *
     */
    name: string;
    /**
     *
     */
    tenant?: string;

    scopes: string[];

    claims?: any;
}

export interface UserContext extends UserContextData {
    getClaims<T=any>(): T;
    isAdmin: boolean;
    hasScope(handlerScope: string): boolean;
    isAnonymous: boolean;
}

export interface UserToken extends UserContext {
    bearer: string;
}

/**
 * User context
 *
 * @export
 * @interface SecurityContext
 */
export class SecurityContext implements UserContext {
    private static EmptyScopes: string[] = [];
    private static UserFields = ["name", "scopes", "tenant", "bearer", "claims"];

    private strategies = new Map<string, IAuthenticationStrategy>();

    constructor(container: IContainer, private scopePolicy: IAuthorizationPolicy) {
        // Default
        this.addOrReplaceStrategy(new TokenService());

        let strategies = container.getList<IAuthenticationStrategy>(DefaultServiceNames.AuthenticationStrategy);
        for(let strategy of strategies) {
            this.addOrReplaceStrategy(strategy);
        }
    }

    addOrReplaceStrategy(strategy: IAuthenticationStrategy) {
        this.strategies.set(strategy.name.toLowerCase(), strategy);
    }

    /**
     * User name
     *
     * @type {string}
     * @memberOf UserContext
     */
    name: string;

    /**
     * Claims
     */
    claims: any;
    /**
     * Get user scopes
     *
     * @readonly
     * @type {Array<string>}
     */
    get scopes(): Array<string> {
        return this._isAnonymous || !this._scopes ? SecurityContext.EmptyScopes : this._scopes;
    }

    get isAnonymous() {
        return this._isAnonymous;
    }

    private _scopes: string[];
    private _isAnonymous: boolean;
    public tenant: string;

    // For context propagation
    bearer: string;

    getClaims<T=any>() {
        return this.claims as T;
    }

    setTenant(tenantOrCtx: string | UserContextData) {
        if (typeof tenantOrCtx === "string") {
            this.tenant = tenantOrCtx;
        }
        else if (tenantOrCtx) {
            this.tenant = tenantOrCtx.tenant;
            this.name = tenantOrCtx.name;
            this._scopes = tenantOrCtx.scopes;
            this.claims = tenantOrCtx.claims;
        }
        else
            this.tenant = Service.defaultTenant;
    }

    async process(ctx: RequestContext) {

        let authorization = <string>ctx.request.headers['authorization'];

        // Perhaps in cookies
        if (!authorization)
            authorization = this.findInCookie(ctx);

        if (!authorization) {
            // Anonymous
            this.name = "Anonymous";
            this._isAnonymous = true;
            this.claims = {};
            ctx.logInfo(() => `No authentication context: User access is anonymous `);
            return;
        }

        let parts = authorization.split(' ');
        if (parts.length < 2) {
            throw new UnauthorizedRequestError("Invalid authorization header : " + authorization);
        }

        let scheme = parts[0], token = parts[1];
        for (let [name, strategy] of this.strategies.entries()) {
            if (!scheme || scheme.substr(0, name.length).toLowerCase() !== name)
                continue;
            if (!token) { throw new UnauthorizedRequestError("Invalid authorization header."); }
            try {
                let userContext = await strategy.verifyToken(ctx, token, this.tenant);
                if (userContext) {
                    this.name = userContext.name;
                    this._scopes = userContext.scopes;
                    this.tenant = userContext.tenant || this.tenant;
                    this.bearer = (<UserToken>userContext).bearer;
                    // Assign all other fields as claims
                    this.claims = userContext.claims || {};
                    Object.keys(userContext).forEach(k => {
                        if (SecurityContext.UserFields.indexOf(k) < 0)
                            this.claims[k] = userContext[k];
                    });

                    // For context propagation
                    if (strategy instanceof TokenService)
                        this.bearer = token;

                    ctx.logInfo(() => `User ${this.name} authenticated with tenant ${this.tenant}, scopes ${this.scopes}`);
                    return;
                }
            }
            catch (err) {
                ctx.logError(err, () => `Authentication error ${err.message || err}`);
                throw err;
            }
        }

        throw new UnauthorizedRequestError();
    }

    hasScope(handlerScope: string): boolean {
        //  this.logVerbose(() => `Check scopes [${this.scopes}] for user ${this.name} to handler scope ${handlerScope}`);
        return (!this._isAnonymous && (!handlerScope || handlerScope === "?"))
            || this.scopePolicy.hasScope(this, handlerScope);
    }

    getUserContext(): UserContextData {
        return {
            tenant: this.tenant,
            name: this.name,
            scopes: this._scopes,
            claims: this.claims
        };
    }

    /**
     * Check if the current user is an admin
     *
     * @returns {boolean}
     */
    get isAdmin(): boolean {
        return !this._isAnonymous && this.scopePolicy.isAdmin(this);
    }

    // From https://github.com/jshttp/cookie
    private findInCookie(ctx: RequestContext) {
        function tryDecode(str) {
            try {
                return decodeURIComponent(str);
            } catch (e) {
                return str;
            }
        }

        const pairSplitRegExp = /; */;

        let cookies = (<string>ctx.request.headers.cookie);
        if (!cookies)
            return null;

        let pairs = cookies.split(pairSplitRegExp);

        for (let pair of pairs) {
            let eq_idx = pair.indexOf('=');

            // skip things that don't look like key=value
            if (eq_idx < 0) {
                continue;
            }

            let key = pair.substr(0, eq_idx).trim();
            if (key !== "authorization")
                continue;

            let val = pair.substr(++eq_idx, pair.length).trim();

            // quoted values
            if ('"' === val[0]) {
                val = val.slice(1, -1);
            }

            return tryDecode(val);
        }

        return null;
    }
}
