import { IRequestContext, Pipeline, RequestData, ICustomEvent } from './common';
import { IContainer } from '../di/resolvers';
import { SecurityContext, UserContextData } from '../security/securityContext';
import { IAuthorizationPolicy } from "../security/authorizationPolicy";
import { DefaultServiceNames } from '../di/annotations';
import { Container } from '../di/containers';
import { HttpRequest } from "./vulcainPipeline";
import { ICommand } from "../commands/abstractCommand";
import { CommandFactory } from "../commands/commandFactory";
import { HttpResponse } from "./response";
import { ISpanRequestTracker, DummySpanTracker, TrackerId } from '../instrumentations/common';
import { Span } from '../instrumentations/span';
import { Conventions } from '../utils/conventions';
import { Service, ServiceStatus } from '../globals/system';

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
    static X_VULCAIN_USE_STUB = 'x-vulcain-use-stub-session';
    static X_VULCAIN_REGISTER_STUB = 'x-vulcain-save-stub-session';
}

export class ContextWrapper implements IRequestContext {
    private _tracker: ISpanRequestTracker;
    private _requestData: RequestData;
    public parent: RequestContext;
    get user() { return this.parent.user; }
    get container() { return this.parent.container; }
    get locale() { return this.parent.locale; }
    get hostName() { return this.parent.hostName; }
    get requestData() { return this._requestData; }
    get request() { return this.parent.request; }
    get publicPath() { return this.parent.publicPath; }
    set keepConnected(flag: boolean) { this.parent.keepConnected = flag; }
    
    setServiceIsBusy(timeoutInMs=0) { this.parent.setServiceIsBusy(timeoutInMs);}
    setServiceIsReady() { this.parent.setServiceIsReady();}

    constructor(context: IRequestContext, data: string|RequestData) {
        this.parent = <RequestContext>context;
        this._tracker = typeof data === "string"
            ? this.parent.requestTracker.createCommandTracker(this, data)
            : this.parent.requestTracker;
        this._requestData = typeof data === "object"
            ? data
            : this.parent.requestData;
    }

    get requestTracker() {
        return this._tracker;
    }

    getBearerToken() {
        return this.user.bearer;
    }

    setBearerToken(token: string) {
        this.user.bearer = token;
    }
    get now() {
        return this.parent.now;
    }
    createCommandRequest(commandName: string) {
        return new ContextWrapper(this, commandName);
    }
    createCustomTracker(name: string, tags?: { [index: string]: string }) {
        return this._tracker.createCustomTracker(this, name, tags);
    }
    getRequestDataObject() {
        return this.parent.getRequestDataObject();
    }
    sendCustomEvent(action: string, params?: any, schema?: string) {
        return this.parent.sendCustomEvent(action, params, schema);
    }

    logError(error: Error, msg?: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logError(error, msg);
        }
    }

    logInfo(msg: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logInfo(msg);
        }
    }

    logVerbose(msg: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logVerbose(msg);
        }
    }

    dispose() {
        this._tracker.dispose();
        this._tracker = null;
    }
}

export class RequestContext implements IRequestContext {
    parent: IRequestContext;
    container: IContainer;
    locale: string;
    requestData: RequestData;
    keepConnected: boolean;
    response: HttpResponse;
    request: HttpRequest;
    private _securityManager: SecurityContext;
    _tracker: ISpanRequestTracker;
    private _customEvents: Array<ICustomEvent>;

    setServiceIsBusy(timeoutInMs=0) { Service.setServiceStatus(ServiceStatus.Busy, timeoutInMs);}
    setServiceIsReady() { Service.setServiceStatus(ServiceStatus.Ready); }
    
    /**
     * Do not use directly
     * Create an instance of RequestContext.
     *
     * @param {IContainer} container
     * @param {Pipeline} pipeline
     */
    constructor(container: IContainer, public pipeline: Pipeline, data?: any /*HttpRequest|EventData|AsyncTaskData*/) {
        this.container = new Container(container, this);
        if (!data) {
            this.requestData = <any>{};
            this._tracker = new DummySpanTracker(this);
            return;
        }

        if (data.headers) {
            this.request = data;
            this.requestData = <any>{};
        }
        else { // for test or async task
            this.request = <any>{ headers: {} };
            this.requestData = {
                vulcainVerb: `${data.schema}.${data.action}`,
                action: data.action,
                schema: data.schema,
                correlationId: data.correlationId,
                domain: data.domain,
                params: this.pipeline === Pipeline.Event ? data.value : data.params,
                inputSchema: data.inputSchema,
                pageSize: data.pageSize,
                page: data.page,
                body: data.body
            };
        }

        if(!this.requestData.correlationId)
            this.requestData.correlationId = (this.request && this.request.headers[VulcainHeaderNames.X_VULCAIN_CORRELATION_ID]) || Conventions.getRandomId();

        if (this.pipeline !== Pipeline.Test) {
            // For event we do not use parentId to chain traces.
            // However all traces can be aggregated with the correlationId tag.
            const parentId = (this.pipeline !== Pipeline.Event && this.request && <string>this.request.headers[VulcainHeaderNames.X_VULCAIN_PARENT_ID]) || null;
            const trackerId: TrackerId = { spanId: parentId, correlationId: this.requestData.correlationId };
            this._tracker = Span.createRequestTracker(this, trackerId);
        }
        else {
            this._tracker = new DummySpanTracker(this);
        }
    }

    get requestTracker() {
        return this._tracker;
    }

    createCustomTracker(name: string, tags?: { [index: string]: string }) {
        return this._tracker.createCustomTracker(this, name, tags);
    }

    getBearerToken() {
        return this.user.bearer;
    }

    setBearerToken(token: string) {
        this.user.bearer = token;
    }

    createCommandRequest(commandName: string) {
        return new ContextWrapper(this, commandName);
    }

    get now() {
        return this._tracker.now;
    }

    getRequestDataObject() {
        return {
            vulcainVerb: this.requestData.vulcainVerb,
            correlationId: this.requestData.correlationId,
            action: this.requestData.action,
            domain: this.requestData.domain,
            schema: this.requestData.schema,
            params: this.requestData.params,
            pageSize: this.requestData.pageSize,
            page: this.requestData.page
        };
    }

    get user() {
        return this._securityManager;
    }

    setSecurityManager(tenant: string|UserContextData) {
        if (!tenant)
            throw new Error("Tenant can not be null");
        let manager = this.container.get<SecurityContext>(DefaultServiceNames.SecurityManager, true);
        if (!manager) {
            let scopePolicy = this.container.get<IAuthorizationPolicy>(DefaultServiceNames.AuthorizationPolicy);
            manager = new SecurityContext(this.container, scopePolicy);
        }
        manager.setTenant(tenant);
        this._securityManager = manager;
    }

    sendCustomEvent(action: string, params?: any, schema?: string) {
        if (!action) {
            throw new Error("Action is required for custom event.");
        }
        if (!this._customEvents) {
            this._customEvents = [];
        }
        this._customEvents.push({ action, schema, params });
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logError(error, msg);
        }
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logInfo(msg);
        }
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: () => string) {
        // tracker can be null in case of command timeout
        // then the context has been disposed.
        // This method can be however called when the request ends
        if (this._tracker) {
            this._tracker.logVerbose(msg);
        }
    }

    get hostName() {
        let host = <string>this.request.headers['x-forwarded-host'];
        return (host || <string>this.request.headers["host"]) || null;
    }

    /**
     * Public path used to exposed this service - Set only for public service
     *
     * @readonly
     *
     * @memberOf RequestContext
     */
    get publicPath() {
        return (this.request && this.request.headers[VulcainHeaderNames.X_VULCAIN_PUBLICPATH]) || null;
    }

    dispose() {
        this._tracker.dispose();
        this.container.dispose();
    }
}