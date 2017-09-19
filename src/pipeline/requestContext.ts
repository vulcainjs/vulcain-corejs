import { IRequestContext, Pipeline, RequestData } from './common';
import { IContainer } from '../di/resolvers';
import { SecurityManager, UserContext } from '../security/securityManager';
import { IAuthorizationPolicy } from "../security/authorizationPolicy";
import { DefaultServiceNames } from '../di/annotations';
import { Container } from '../di/containers';
import { Logger } from "../log/logger";
import { Metrics } from "./middlewares/metricsMiddleware";
import { HttpRequest } from "./vulcainPipeline";
import { ApplicationRequestError } from "./errors/applicationRequestError";
import { DefaultAuthentication } from "../security/defaultAuthentication";
import { ICommand } from "../commands/abstractCommand";
import { CommandFactory } from "../commands/commandFactory";
import { HttpResponse } from "./response";
import { EventData } from "./handlers/messageBus";
import { AsyncTaskData } from "./handlers/actions";
import { System } from '../globals/system';
const guid = require('uuid');
import * as os from 'os';
import { Span } from '../trace/span';

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
    requestData: RequestData;
    response: HttpResponse;
    metrics: Metrics;
    request: HttpRequest;
    private _securityManager: SecurityManager;
    private rootSpan: Span;

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
            vulcainVerb: this.requestData.vulcainVerb,
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
        this.container = new Container(container, this);
        if (!data) {
            this.requestData = <any>{};
            return;
        }

        if (data.headers) {
            this.request = data;
        }
        else { // for test or async task
            this.requestData = {
                vulcainVerb: `${data.schema}.${data.action}`,
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
        this.rootSpan = Span.createRootSpan(this);
    }

    sendCustomEvent(action: string, params?: any, schema?: string) {
        throw new Error("Method not implemented."); // TODO
    }

  /**
     * Create a new command
     * Throws an exception if the command is unknown
     *
     * @param {string} name Command name
     * @param {string} [schema] Optional schema used to initialize the provider
     * @returns {ICommand} A command
     */
    getCommandAsync<T = ICommand>(name: string, schema?: string): Promise<T> {
        return CommandFactory.getAsync<T>(name, this, schema);
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: ()=>string) {
        this.rootSpan.logError(this, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: ()=>string) {
        this.rootSpan.logInfo(this, msg);
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
        this.rootSpan.logVerbose(this, msg);
    }

    get hostName() {
        let host = <string>this.request.headers['X-Forwarded-Host'];
        return host || <string>this.request.headers["Host"];
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

    injectTraceHeaders(commandTracker, headers: (name: string|any, value?: string) => any) {
        headers(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, this.correlationId);
        //header(VulcainHeaderNames.X_VULCAIN_PARENT_ID, this.requestContext.traceId);
        headers(VulcainHeaderNames.X_VULCAIN_SERVICE_NAME, System.serviceName);
        headers(VulcainHeaderNames.X_VULCAIN_SERVICE_VERSION, System.serviceVersion);
        headers(VulcainHeaderNames.X_VULCAIN_ENV, System.environment);
        headers(VulcainHeaderNames.X_VULCAIN_CONTAINER, os.hostname());
        if (this.request.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK]) {
            headers(VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK, <string>this.request.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK]);
        }
        if (this.request.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK]) {
            headers(VulcainHeaderNames.X_VULCAIN_USE_MOCK, <string>this.request.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK]);
        }
        this.metrics && this.metrics.tracer && this.metrics.tracer.injectTraceHeaders(commandTracker, headers);
    }

    dispose() {
        this.container.dispose();
    }
}