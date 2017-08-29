import { IRequestContext, Pipeline, RequestData } from './common';
import { IContainer } from '../di/resolvers';
import { SecurityManager, UserContext } from '../security/securityManager';
import { IAuthorizationPolicy } from "../security/authorizationPolicy";
import { DefaultServiceNames } from '../di/annotations';
import { Container } from '../di/containers';
import { Logger } from "../configurations/log/logger";
import { CommandMetrics } from "./middlewares/metricsMiddleware";
import { HttpRequest } from "./vulcainPipeline";
import { ApplicationRequestError } from "./errors/applicationRequestError";
import { DefaultAuthentication } from "../security/defaultAuthentication";
import { ICommand } from "../commands/abstractCommand";
import { CommandFactory } from "../commands/commandFactory";
import { HttpResponse } from "./response";
import { EventData } from "./handlers/messageBus";
import { AsyncTaskData } from "./handlers/actions";
const guid = require('uuid');

export class VulcainHeaderNames {
    static X_VULCAIN_TENANT = "x-vulcain-tenant";
    static X_VULCAIN_CORRELATION_ID = "x-vulcain-correlation-id";
    static X_VULCAIN_TRACE_ID = "x-vulcain-trace-id";
    static X_VULCAIN_PARENT_ID = "x-vulcain-parent-id";
    static X_VULCAIN_SERVICE_NAME = "x-vulcain-service-name";
    static X_VULCAIN_SERVICE_VERSION = "x-vulcain-service-version";
    static X_VULCAIN_ENV = "x-vulcain-env";
    static X_VULCAIN_CONTAINER = "x-vulcain-container";
    static X_VULCAIN_PUBLICPATH = "x-vulcain-publicpath";
    static X_VULCAIN_USE_MOCK = 'x-vulcain-use-mock-session';
    static X_VULCAIN_REGISTER_MOCK = 'x-vulcain-register-mock-session';
}

export class RequestContext implements IRequestContext {
    container: IContainer;
    locale: string;
    hostName: string;
    requestData: RequestData;
    response: HttpResponse;
    metrics: CommandMetrics;
    request: HttpRequest;

    private _securityManager: SecurityManager;
    private _logger: Logger;

    getBearerToken() {
        return this.security.bearer;
    }

    setBearerToken(token: string) {
        this.security.bearer = token;
    }

    get correlationId(): string {
        let id = this.requestData.correlationId;
        if (id) {
            return id;
        }
        return this.requestData.correlationId = (this.request && this.request.headers[VulcainHeaderNames.X_VULCAIN_CORRELATION_ID]) || RequestContext.createUniqueId();
    }

    getRequestDataObject() {
        return {
            correlationId: this.correlationId,
            action: this.requestData.action,
            domain: this.requestData.domain,
            schema: this.requestData.schema,
            params: this.requestData.params,
            maxByPage: this.requestData.maxByPage,
            page: this.requestData.page
        };
    }

    get security() {
        return this._securityManager;
    }

    setSecurityManager(tenant: string|UserContext) {
        if (!tenant)
            throw new Error("Tenant can not be null");
        let manager = this.container.get<SecurityManager>(DefaultServiceNames.Authentication, true);
        if (!manager) {
            let scopePolicy = this.container.get<IAuthorizationPolicy>(DefaultServiceNames.AuthorizationPolicy);
            manager = new DefaultAuthentication(scopePolicy);
        }
        manager.setTenant(tenant);
        this._securityManager = manager;
    }

    /**
     * Do not use directly
     * Creates an instance of RequestContext.
     *
     * @param {IContainer} container
     * @param {Pipeline} pipeline
     */
    constructor(container: IContainer, public pipeline: Pipeline, data?: any /*HttpRequest|EventData|AsyncTaskData*/) {
        this._logger = container.get<Logger>(DefaultServiceNames.Logger);
        this.container = new Container(container, this);
        if (!data) {
            this.requestData = <any>{};
            return;
        }
        
        if (data.headers) {
            this.request = data;
        }
        else {
            this.requestData = {
                action: data.action,
                schema: data.schema,
                correlationId: data.correlationId,
                domain: data.domain,
                params: data.params,
                inputSchema: data.inputSchema,
                maxByPage: data.maxByPage,
                page: data.page,
                body: data.body
            }
        }
    }

    sendCustomEvent(action: string, params?: any, schema?: string) {
        throw new Error("Method not implemented.");
    }

  /**
     * Create a new command
     * Throws an exception if the command is unknown
     *
     * @param {string} name Command name
     * @param {string} [schema] Optional schema used to initialize the provider
     * @returns {ICommand} A command
     */
    getCommandAsync<T = ICommand>(name: string, schema?: string) {
        return <T><any>CommandFactory.getAsync(name, this, schema);
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: ()=>string) {
        this._logger.error(this, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: ()=>string) {
        this._logger.info(this, msg);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: ()=>string) {
        this._logger.verbose(this, msg);
    }

    static createUniqueId() {
        return guid.v4().replace(/-/g, '');
    }

    /**
     * Public path used to exposed this service - Set only for public service
     *
     * @readonly
     *
     * @memberOf RequestContext
     */
    get publicPath() {
        return this.request && this.request.headers[VulcainHeaderNames.X_VULCAIN_PUBLICPATH];
    }

    dispose() {
        this.container.dispose();
    }
}