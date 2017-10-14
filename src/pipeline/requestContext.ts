import { IRequestContext, Pipeline, RequestData, ICustomEvent } from './common';
import { IContainer } from '../di/resolvers';
import { SecurityContext, UserContextData } from '../security/securityContext';
import { IAuthorizationPolicy } from "../security/authorizationPolicy";
import { DefaultServiceNames } from '../di/annotations';
import { Container } from '../di/containers';
import { Logger } from "../log/logger";
import { HttpRequest } from "./vulcainPipeline";
import { ApplicationError } from "./errors/applicationRequestError";
import { ICommand } from "../commands/abstractCommand";
import { CommandFactory } from "../commands/commandFactory";
import { HttpResponse } from "./response";
import { EventData } from "./handlers/messageBus";
import { AsyncTaskData } from "./handlers/actions";
import { System } from '../globals/system';
const guid = require('uuid');
import * as os from 'os';
import {  SpanKind, ISpanRequestTracker, DummySpanTracker } from '../trace/common';
import { Span } from '../trace/span';
import { DefaultCRUDCommand } from '../defaults/crudHandlers';
import { TrackerInfo } from '../trace/common';

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
    static X_VULCAIN_REGISTER_MOCK = 'x-vulcain-save-mock-session';
}

export class CommandRequest implements IRequestContext {
    tracker: ISpanRequestTracker;
    private context: RequestContext;
    get user() { return this.context.user; }
    get container() { return this.context.container; }
    get locale() { return this.context.locale; }
    get hostName() { return this.context.hostName; }
    get requestData() { return this.context.requestData; }
    get request() { return this.context.request; }
    get publicPath() { return this.context.publicPath; }

    constructor(context: IRequestContext, commandName: string) {
        this.context = <RequestContext>context;
        this.tracker = this.context.tracker.createCommandTracker(this, commandName);
    }

    getTrackerInfo(): TrackerInfo {
        return this.tracker.id;
    }

    trackAction(action: string, tags?: any) {
        this.tracker.trackAction(action, tags);
    }

    addTrackerTags(tags?: any) {
        this.tracker.addTrackerTags(tags);
    }

    get durationInMs() {
        return this.tracker.durationInMs;
    }

    injectHeaders(headers: (name: string | any, value?: string) => any) {
        this.tracker.injectHeaders(headers);
    }

    getBearerToken() {
        return this.user.bearer;
    }

    setBearerToken(token: string) {
        this.user.bearer = token;
    }
    get now() {
        return this.context.now;
    }
    createCommandRequest(commandName: string) {
        return new CommandRequest(this, commandName);
    }

    getRequestDataObject() {
        return this.context.getRequestDataObject();
    }
    sendCustomEvent(action: string, params?: any, schema?: string) {
        return this.context.sendCustomEvent(action, params, schema);
    }
    getCommand<T = ICommand>(name: string, ...args): T {
        return this.context.getCommand<T>(name, args);
    }
    getDefaultCRUDCommand(schema: string): DefaultCRUDCommand {
        return this.context.getDefaultCRUDCommand(schema);
    }
    logError(error: Error, msg?: () => string) {
        return this.tracker.logError(error, msg);
    }
    logInfo(msg: () => string) {
        return this.tracker.logInfo(msg);
    }
    logVerbose(msg: () => string) {
        return this.tracker.logVerbose(msg);
    }
    dispose() {
        this.tracker.dispose();
        this.tracker = null;
    }
}

export class RequestContext implements IRequestContext {
    container: IContainer;
    locale: string;
    requestData: RequestData;
    response: HttpResponse;
    request: HttpRequest;
    private _securityManager: SecurityContext;
    tracker: ISpanRequestTracker;
    private _customEvents: Array<ICustomEvent>;

    getTrackerInfo(): TrackerInfo {
        let spanId = this.tracker.id;
        let id = this.requestData.correlationId;
        if (!id) {
            this.requestData.correlationId = (this.request && this.request.headers[VulcainHeaderNames.X_VULCAIN_CORRELATION_ID]) || RequestContext.createUniqueId();
        }

        spanId.correlationId = id;
        return spanId;
    }

    injectHeaders(headers: (name: string | any, value?: string) => any) {
        this.tracker.injectHeaders(headers);
    }
    trackAction(action: string, tags?:any) {
        this.tracker.trackAction(action, tags);
    }
    addTrackerTags(tags?: any) {
        this.tracker.addTrackerTags(tags);
    }
    get durationInMs() {
        return this.tracker.durationInMs;
    }
    getBearerToken() {
        return this.user.bearer;
    }

    setBearerToken(token: string) {
        this.user.bearer = token;
    }

    createCommandRequest(commandName: string) {
        return new CommandRequest(this, commandName);
    }

    get now() {
        return this.tracker.now;
    }

    getRequestDataObject() {
        return {
            vulcainVerb: this.requestData.vulcainVerb,
            correlationId: this.requestData.correlationId,
            action: this.requestData.action,
            domain: this.requestData.domain,
            schema: this.requestData.schema,
            params: this.requestData.params,
            maxByPage: this.requestData.maxByPage,
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
            this.tracker = new DummySpanTracker();
            return;
        }

        if (data.headers) {
            this.request = data;
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
                maxByPage: data.maxByPage,
                page: data.page,
                body: data.body
            }
        }
        if (this.pipeline !== Pipeline.Test) {
            // For event we don not use parentId to chain traces.
            // However all traces can be aggredated with the correlationId tag.
            let parentId = this.pipeline !== Pipeline.Event && this.request && <string>this.request.headers[VulcainHeaderNames.X_VULCAIN_PARENT_ID];
            this.tracker = Span.createRequestTracker(this, parentId);
        }
        else {
            this.tracker = new DummySpanTracker();
        }
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
     * Create a new command
     * Throws an exception if the command is unknown
     *
     * @param {string} name Command name
     * @returns {ICommand} A command
     */
    getCommand<T = ICommand>(name: string, ...args): T {
        return CommandFactory.getCommand<T>(name, this, args);
    }

    getDefaultCRUDCommand(schema: string): DefaultCRUDCommand {
        return CommandFactory.getProviderCommand("DefaultCRUDCommand", this, schema);
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: ()=>string) {
        this.tracker.logError(error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: ()=>string) {
        this.tracker.logInfo(msg);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: ()=>string) {
        this.tracker.logVerbose(msg);
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

    dispose() {
        this.tracker.dispose();
        this.container.dispose();
    }
}