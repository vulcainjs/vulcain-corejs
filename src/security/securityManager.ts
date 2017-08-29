import { IAuthorizationPolicy } from './authorizationPolicy';
import { System } from "../configurations/globals/system";
import { RequestContext } from "../pipeline/requestContext";
import { ApplicationRequestError, UnauthorizedRequestError } from "../pipeline/errors/applicationRequestError";
import { VulcainLogger } from "../configurations/log/vulcainLogger";
import { DefaultServiceNames, Inject } from "../di/annotations";
import { Model, Property } from '../schemas/annotations';

@Model()
export class VerifyTokenParameter {
    @Property({ type: "string", required: true })
    token: string;
    @Property({ type: "string" })
    tenant: string;
}

export interface ITokenService {
    verifyTokenAsync(data: VerifyTokenParameter): Promise<UserToken>;
    createTokenAsync(user: UserContext): Promise<{ expiresIn: number, token: string, renewToken: string }>;
}

export interface UserContext {
    /**
     * User display name
     *
     * @type {string}
     * @memberOf UserContext
     */
    displayName?: string;
    /**
     * User email
     *
     * @type {string}
     * @memberOf UserContext
     */
    email?: string;
    /**
     * User name
     *
     * @type {string}
     * @memberOf UserContext
     */
    name: string;
    /**
     *
     *
     * @type {string}
     * @memberOf UserContext
     */
    tenant: string;        

    scopes: string[];
}

export interface UserToken extends UserContext {
    bearer: string;
    data?: string;
}

/**
 * User context
 *
 * @export
 * @interface SecurityManager
 */
export abstract class SecurityManager implements UserContext {
    private static EmptyScopes: string[] = [];
    private strategies: { name: string, verify: (ctx: RequestContext, token: string) => Promise<UserToken> }[] = [];
    
    addOrReplaceStrategy(name: string, verify: (ctx: RequestContext, token: string) => Promise<UserToken>) {
        this.strategies.push({ name, verify });
    }
    
    /**
     * User display name
     *
     * @type {string}
     * @memberOf UserContext
     */
    displayName?: string;
    /**
     * User email
     *
     * @type {string}
     * @memberOf UserContext
     */
    email?: string;
    /**
     * User name
     *
     * @type {string}
     * @memberOf UserContext
     */
    name: string;

    /**
     * Get user scopes
     *
     * @readonly
     * @type {Array<string>}
     */
    get scopes(): Array<string> {
        return this._isAnonymous || !this._scopes ? SecurityManager.EmptyScopes : this._scopes;
    }
    
    private _scopes: string[];
    private _isAnonymous: boolean;
    private _tenant?: string;
    // For context propagation   
    bearer: string;

    /**
     *
     *
     * @type {string}
     */
    get tenant(): string {
        return this._tenant;
    }

    constructor(private _scopePolicy: IAuthorizationPolicy) { }
    
    setTenant(tenantOrCtx: string | UserContext) {
        if (typeof tenantOrCtx === "string") {
            this._tenant = tenantOrCtx;
        }
        else if (tenantOrCtx) {
            this._tenant = tenantOrCtx.tenant;
            this.name = tenantOrCtx.name;
            this.displayName = tenantOrCtx.displayName;
            this.email = tenantOrCtx.email;
            this._scopes = tenantOrCtx.scopes;
        }
        else
            this._tenant = System.defaultTenant;
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
            ctx.logInfo(() => `No authentication context: User access is anonymous `);            
            return;
        }

        try {
            let parts = authorization.split(' ');
            if (parts.length < 2) {
                throw new Error("Invalid authorization header : " + authorization);
            }

            let scheme = parts[0], token = parts[1];
            for (let strategy of this.strategies) {
                if (!scheme || scheme.substr(0, strategy.name.length).toLowerCase() !== strategy.name)
                    continue;
                if (!token) { throw new ApplicationRequestError("Invalid authorization header."); }

                let userContext = await strategy.verify(ctx, token);
                if (userContext) {
                    this.name = userContext.name;
                    this.displayName = userContext.displayName;
                    this.email = userContext.email;
                    this._scopes = userContext.scopes;
                    this._tenant = userContext.tenant || this._tenant;
                    this.bearer = userContext.bearer;
//                    this.data = userContext.data;

                    // For context propagation
                    if (strategy.name === "bearer")
                        this.bearer = token;

                    ctx.logInfo(() => `User ${this.name} authentified with tenant ${this._tenant}, scopes ${this.scopes}`);
                    return;
                }
                else if (strategy.name !== "bearer") {
                    throw new UnauthorizedRequestError();
                }
                return;
            }
        }
        catch (err) {
            ctx.logError(err, () => "Authentication error");
        }

        throw new UnauthorizedRequestError();
    }

    userHasScope(handlerScope: string): boolean {
        //  this.logVerbose(() => `Check scopes [${this.scopes}] for user ${this.name} to handler scope ${handlerScope}`);
        return (!this._isAnonymous && (!handlerScope || handlerScope === "?"))
            || this._scopePolicy.hasScope(this, handlerScope);
    }

    getUserContext(): UserContext {
        return { tenant: this.tenant, displayName: this.displayName, email: this.email, name: this.name, scopes: this._scopes };
    }

    /**
     * Check if the current user is an admin
     *
     * @returns {boolean}
     */
    isAdmin(): boolean {
        return !this._isAnonymous && this._scopePolicy.isAdmin(this);
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
          
        for (let i = 0; i < pairs.length; i++) {
            let pair = pairs[i];
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
            if ('"' == val[0]) {
                val = val.slice(1, -1);
            }
          
            return tryDecode(val);              
        }
          
        return null;
    }
}
