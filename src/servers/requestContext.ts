import {Container} from '../di/containers';
import {IContainer} from '../di/resolvers';
import {CommandFactory} from '../commands/command/commandFactory';
import {DefaultServiceNames} from '../di/annotations';
import { IPolicy } from './policy/defaultPolicy';
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
    id: string;
    displayName?: string;
    email?: string;
    name: string;
    scopes: Array<string>;
    tenant: string;
}

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
    info(ctx: RequestContext,  msg: string, ...params: Array<any>);

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    verbose(ctx: RequestContext,  msg: string, ...params: Array<any>);
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

    public _scopePolicy: IPolicy;
    /**
     * Current user or null
     *
     * @type {UserContext}
     */
    public user: UserContext;
    private _cache: Map<string, any>;
    private _logger: Logger;
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
        this._scopePolicy = container.get<IPolicy>(DefaultServiceNames.ScopesPolicy);
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
