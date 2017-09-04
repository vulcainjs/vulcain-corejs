import { DefaultServiceNames, Inject } from './../di/annotations';
import { IContainer } from './../di/resolvers';
import { System } from './../configurations/globals/system';
import { DynamicConfiguration } from './../configurations/dynamicConfiguration';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { VulcainLogger } from '../configurations/log/vulcainLogger';
import { IServiceResolver } from '../configurations/globals/serviceResolver';
import * as types from './types';
import 'reflect-metadata';
const rest = require('unirest');
import * as URL from 'url';
import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { IRequestContext } from "../pipeline/common";
import { ApplicationRequestError } from "../pipeline/errors/applicationRequestError";
import { ITokenService } from "../security/securityManager";
import { QueryResult } from "../pipeline/handlers/query";
import { ActionResult } from "../pipeline/handlers/actions";


export class HttpCommandError extends ApplicationRequestError {
    response: types.IHttpCommandResponse;
    error: Error;

    constructor(msg, response: types.IHttpCommandResponse | Error, statusCode?: number) {
        super(msg);
        if(!response) {
            return;
        }

        if (response instanceof Error) {
            this.error = response;
            this.statusCode = statusCode || 500;
        }
        else {
            this.response = response;
            this.statusCode = statusCode || response.status;
        }
    }
}

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T
 */
export abstract class AbstractServiceCommand {
    private overrideAuthorization: string;
    private overrideTenant: string;
    protected metrics: IMetrics;
    private customTags: any;
    private logger: VulcainLogger;
    private commandTracker: any;

    @Inject(DefaultServiceNames.ServiceResolver)
    serviceResolver: IServiceResolver;

    /**
     *
     *
     * @type {IRequestContext}
     */
    public requestContext: IRequestContext;

    private static METRICS_NAME = "service_call";

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor( @Inject(DefaultServiceNames.Container) public container: IContainer) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);
        this.initializeMetricsInfo();
    }

    /**
     * Set (or reset) user context to use for calling service.
     *
     * @protected
     * @param {string} apiKey - null for reset
     * @param {string} tenant - null for reset
     *
     * @memberOf AbstractServiceCommand
     */
    protected setRequestContext(apiKey?: string, tenant?: string) {
        if (!apiKey) {
            this.overrideAuthorization = null;
        }
        else {
            this.overrideAuthorization = "ApiKey " + apiKey;
        }
        this.overrideTenant = tenant;
    }

    protected initializeMetricsInfo() {
        let dep = this.constructor["$dependency:service"];
        if (!dep) {
            throw new Error("ServiceDependency annotation is required on command " + Object.getPrototypeOf(this).constructor.name);
        }
        this.setMetricsTags(dep.targetServiceName, dep.targetServiceVersion, false);
    }

    protected setMetricsTags(targetServiceName: string, targetServiceVersion: string, emitLog = true) {

        let exists = System.manifest.dependencies.services.find(svc => svc.service === targetServiceName && svc.version === targetServiceVersion);
        if (!exists) {
            System.manifest.dependencies.services.push({ service: targetServiceName, version: targetServiceVersion });
        }
        this.customTags = { targetServiceName: targetServiceName, targetServiceVersion: targetServiceVersion };

        if (emitLog) {
            this.logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            this.logger.logAction(this.requestContext, "BC", "Service", `Command: ${Object.getPrototypeOf(this).constructor.name} Calling service ${targetServiceName}, version: ${targetServiceVersion}`);
            this.commandTracker = this.requestContext.metrics.startCommand("Call service", `${targetServiceName}-${targetServiceVersion}`);
        }
    }

    onCommandCompleted(duration: number, success: boolean) {
        this.metrics.timing(AbstractServiceCommand.METRICS_NAME + MetricsConstant.duration, duration, this.customTags);
        if (!success)
            this.metrics.increment(AbstractServiceCommand.METRICS_NAME + MetricsConstant.failure, this.customTags);
        this.logger && this.logger.logAction(this.requestContext, 'EC', 'Service', `Command: ${Object.getPrototypeOf(this).constructor.name} completed with ${success ? 'success' : 'error'}`);
        this.requestContext.metrics.finishCommand(this.commandTracker, success);
    }

    /**
     *
     *
     * @private
     * @param {string} serviceName
     * @param {number} version
     * @returns
     */
    protected async createServiceName(serviceName: string, version: string) {
        if (!serviceName)
            throw new Error("You must provide a service name");
        if (!version || !version.match(/[0-9]+\.[0-9]+/))
            throw new Error("Invalid version number. Must be on the form major.minor");

        this.setMetricsTags(serviceName, version);

        let alias = System.resolveAlias(serviceName, version);
        if (alias)
            return alias;

        if (System.isDevelopment) {
            try {
                let deps = System.manifest.dependencies.services.find(svc => svc.service === serviceName && svc.version === version);
                if (deps && deps.discoveryAddress) {
                    const url = URL.parse(deps.discoveryAddress);
                    return url.host;
                }
            }
            catch (e) {/*ignore*/ }
        }

        return await this.serviceResolver.resolveAsync(serviceName, version);
    }

    /**
     * get a domain element
     * @param serviceName - full service name
     * @param version - version of the service
     * @param id - Element id
     * @param schema - optional element schema
     * @returns A vulcain request response
     *
     * @protected
     * @template T
     * @param {string} serviceName
     * @param {number} version
     * @param {string} id
     * @param {string} [schema]
     * @returns {Promise<QueryResponse<T>>}
     */
    protected async getRequestAsync<T>(serviceName: string, version: string, id: string, args?, schema?: string): Promise<QueryResult> {
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(serviceName, version, schema ? schema + ".get" : "get", { id });
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for ${serviceName}`);
            return result;
        }

        let url = System.createUrl(`http://${await this.createServiceName(serviceName, version)}`, 'api', schema, 'get', id, args);
        let res = this.sendRequestAsync("get", url);
        return res;
    }

    /**
     *
     *
     * @protected
     * @template T
     * @param {string} serviceName
     * @param {number} version
     * @param {string} action
     * @param {*} [query]
     * @param {number} [page]
     * @param {number} [maxByPage]
     * @param {string} [schema]
     * @returns {Promise<QueryResponse<T>>}
     */
    protected async getQueryAsync<T>(serviceName: string, version: string, verb: string, query?: any, args?, page?: number, maxByPage?: number, schema?: string): Promise<QueryResult> {
        let data: any = {};
        data.$maxByPage = maxByPage;
        data.$page = page;
        data.$query = query && JSON.stringify(query);
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(serviceName, version, verb, data);
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for (${verb}) ${serviceName}`);
            return result;
        }

        let url = System.createUrl(`http://${await this.createServiceName(serviceName, version)}/api/${verb}`, args, data);

        let res = this.sendRequestAsync("get", url);
        return res;
    }

    /**
     *
     *
     * @protected
     * @param {string} serviceName
     * @param {number} version
     * @param {string} action
     * @param {*} data
     * @returns {Promise<ActionResponse<T>>}
     */
    protected async sendActionAsync<T>(serviceName: string, version: string, verb: string, data: any, args?): Promise<ActionResult> {
        let command = { params: data, correlationId: this.requestContext.correlationId };
        const mocks=System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(serviceName, version, verb, data);
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for (${verb}) ${serviceName}`);
            return result;
        }
        let url = System.createUrl(`http://${await this.createServiceName(serviceName, version)}`, 'api', verb, args);
        let res = <any>this.sendRequestAsync("post", url, (req) => req.json(data));
        return res;
    }

    private async setUserContextAsync(request: types.IHttpCommandRequest) {
        request.header(VulcainHeaderNames.X_VULCAIN_TENANT, this.overrideTenant || this.requestContext.security.tenant);

        if (this.overrideAuthorization) {
            request.header("Authorization", this.overrideAuthorization);
            return;
        }

        let ctx = this.requestContext as RequestContext;
        let token = ctx.getBearerToken();
        if (!token) {
            if (!this.requestContext.security) {
                return;
            }
            let tokens = this.requestContext.container.get<ITokenService>(DefaultServiceNames.TokenService);
            // Ensures jwtToken exists for user context propagation
            let result: any = await tokens.createTokenAsync(this.requestContext.security);
            token = result.token;
            ctx.setBearerToken(token);
        }

        request.header("Authorization", "Bearer " + token);
    }

    /**
     * Send a http request
     *
     * @protected
     * @param {string} http verb to use
     * @param {string} url
     * @param {(req:types.IHttpCommandRequest) => void} [prepareRequest] Callback to configure request before sending
     * @returns request response
     */
    protected async sendRequestAsync(verb: string, url: string, prepareRequest?: (req: types.IHttpCommandRequest) => void) {

        let request: types.IHttpCommandRequest = rest[verb](url);

        let ctx = this.requestContext as RequestContext;
        await this.setUserContextAsync(request);
        ctx.injectTraceHeaders(this.commandTracker, request.header);

        prepareRequest && prepareRequest(request);

        this.requestContext.logInfo(()=>"Calling vulcain service on " + url);
        return new Promise<any>((resolve, reject) => {
            try {
                request.end((response: types.IHttpCommandResponse) => {
                    if (response.error || response.status !== 200) {
                        let err;
                        if (response.body) {
                            if (typeof response.body === "object") {
                                err = new ApplicationRequestError(response.body.message, response.status, response.body.errors);
                            }
                            else {
                                err = new ApplicationRequestError(response.body, response.status);
                            }
                        }
                        else {
                            err = new ApplicationRequestError((response.error && response.error.message) || "Unknow error", response.status);
                        }
                        System.log.error(this.requestContext, err, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(err);
                        return;
                    }
                    let vulcainResponse = response.body;
                    if (vulcainResponse.error) {
                        System.log.info(this.requestContext, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(new ApplicationRequestError(vulcainResponse.error.message, response.status, vulcainResponse.error.errors));
                    }
                    else {
                        System.log.info(this.requestContext, ()=>`Service request ${verb} ${url} completed with status code ${response.status}`);
                        resolve(vulcainResponse);
                    }
                });
            }
            catch (err) {
                let msg = ()=>`Service request ${verb} ${url} failed`;
                System.log.error(this.requestContext, err, msg);
                if (!(err instanceof Error)) {
                    let tmp = err;
                    err = new Error(msg());
                    err.error = tmp;
                }
                reject(new HttpCommandError(msg(), err));
            }
        });
    }

    protected async exec(kind: string, serviceName: string, version: string, verb: string, userContext, data, args, page, maxByPage): Promise<any> {
        switch (kind) {
            case 'action': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.sendActionAsync(serviceName, version, verb, data, args);
                return response.value;
            }
            case 'query': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.getQueryAsync(serviceName, version, verb, data, args, page, maxByPage);
                return response.value;
            }
            case 'get': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.getRequestAsync(serviceName, version, data, args);
                return response.value;
            }
        }
    }

    runAsync(...args): Promise<any> {
        return (<any>this).exec(...args);
    }

    // Must be defined in command
    // protected fallbackAsync(err, ...args)
}