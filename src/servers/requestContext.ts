import { Container } from '../di/containers';
import { IContainer } from '../di/resolvers';
import { CommandFactory } from '../commands/command/commandFactory';
import { DefaultServiceNames } from '../di/annotations';
import { IAuthorizationPolicy } from './policy/defaultAuthorizationPolicy';
import { ICommand } from '../commands/command/abstractCommand';

export enum Pipeline {
    EventNotification,
    InProcess,
    HttpRequest,
    Test
}

/**
 * User context
 *
 * @export
 * @interface UserContext
 */
export interface UserContext {
    /**
     * User id
     *
     * @type {string}
     * @memberOf UserContext
     */
    id: string;
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
     * User scopes
     *
     * @type {Array<string>}
     * @memberOf UserContext
     */
    scopes: Array<string>;
    /**
     * Don't use directly - Used requestContext.tenant instead
     *
     * @type {string}
     * @memberOf UserContext
     */
    tenant: string;
}

/**
 * Logger
 *
 * @export
 * @interface Logger
 */
export interface Logger {
    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    error(ctx: RequestContext, error: Error, msg?: string);

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    info(ctx: RequestContext, msg: string, ...params: Array<any>);

    /**
     * Log a verbose message. Verbose messages are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    verbose(ctx: RequestContext, msg: string, ...params: Array<any>);
}

/**
 * Internal use
 *
 * @export
 * @interface ICustomEvent
 */
export interface ICustomEvent {
    action: string;
    schema?: string;
    params?: any;
}

/**
 * Request context
 *
 * @export
 * @class RequestContext
 */
export class RequestContext {
    static TestTenant = "TesT";
    static TestUser = { id: "test", scopes: ["*"], name: "test", displayName: "test", email: "test", tenant: RequestContext.TestTenant };

    private _customEvents: Array<ICustomEvent>;

    /**
     * Request correlation id
     *
     * @type {string}
     */
    correlationId: string;

    /**
     * Request correlation path
     *
     * @type {string}
     */
    correlationPath: string;

    public _scopePolicy: IAuthorizationPolicy;
    /**
     * Current user or null
     *
     * @type {UserContext}
     */
    public user: UserContext;
    private _cache: Map<string, any>;
    private _logger: Logger;
    /**
     * Scoped container
     *
     * @type {IContainer}
     */
    public container: IContainer;
    /**
     * Headers for the current request
     *
     * @type {{ [name: string]: string }}
     */
    public headers: { [name: string]: string };
    /**
     * Current tenant
     *
     * @type {string}
     */
    public tenant: string;

    /**
     * Current locale
     *
     * @type {string}
     * @memberOf RequestContext
     */
    public locale: string;

    /**
     * Request host name
     *
     * @type {string}
     * @memberOf RequestContext
     */
    public hostName: string;

    /**
     * Send custom event from current service
     *
     * @param {string} action action event
     * @param {*} [params] action parameters
     * @param {string} [schema] optional schema
     */
    public sendCustomEvent(action: string, params?: any, schema?: string) {
        if (!action) {
            throw new Error("Action is required for custom event.");
        }
        if (!this._customEvents) {
            this._customEvents = [];
        }
        this._customEvents.push({ action, schema, params });
    }

    /**
     * Get request cache (Cache is only valid during the request lifetime)
     *
     * @readonly
     */
    get cache() {
        if (!this._cache) {
            this._cache = new Map<string, any>();
        }
        return this._cache;
    }

    /**
     * Propagated bearer token
     *
     * @type {string}
     * @memberOf RequestContext
     */
    bearer: string;

    /**
     * Do not use directly
     * Creates an instance of RequestContext.
     *
     * @param {IContainer} container
     * @param {Pipeline} pipeline
     */
    constructor(container: IContainer, public pipeline: Pipeline) {
        this._logger = container.get<Logger>(DefaultServiceNames.Logger);
        this.container = new Container(container, this);
        this._scopePolicy = container.get<IAuthorizationPolicy>(DefaultServiceNames.AuthorizationPolicy);
    }

    dispose() {
        this.container.dispose();
    }

    /**
     * Create a request context for testing
     *
     * @static
     * @param {IContainer} [container]
     * @param {UserContext} [user]
     * @returns
     */
    static createMock(container?: IContainer, user?: UserContext) {
        let ctx = new RequestContext(container || new Container(), Pipeline.Test);
        ctx.user = user || RequestContext.TestUser;
        ctx.user.tenant = ctx.tenant = RequestContext.TestTenant;
        return ctx;
    }

    /**
     * Get user scopes
     *
     * @readonly
     * @type {Array<string>}
     */
    get scopes(): Array<string> {
        return this._scopePolicy.scopes(this);
    }

    hasScope(handlerScope: string): boolean {
        this.logVerbose(`Check scopes [${this.scopes}] for user ${this.user && this.user.name} to handler scope ${handlerScope}`);
        return this._scopePolicy.hasScope(this, handlerScope);
    }

    /**
     * Check if the current user is an admin
     *
     * @returns {boolean}
     */
    isAdmin(): boolean {
        return this._scopePolicy.isAdmin(this);
    }

    /**
     * Create a new command
     * Throws an exception if the command is unknown
     *
     * @param {string} name Command name
     * @param {string} [schema] Optional schema used to initialize the provider
     * @returns {ICommand} A command
     */
    getCommandAsync(name: string, schema?: string): Promise<ICommand> {
        return CommandFactory.getAsync(name, this, schema);
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: string) {
        this._logger.error(this, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: string, ...params: Array<any>) {
        this._logger.info(this, msg, ...params);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: string, ...params: Array<any>) {
        this._logger.verbose(this, msg, ...params);
    }

    /**
     * Public path used to exposed this service - Set only for public service
     *
     * @readonly
     *
     * @memberOf RequestContext
     */
    get publicPath() {
        return this.headers["X-VULCAIN-PUBLICPATH"];
    }
}
