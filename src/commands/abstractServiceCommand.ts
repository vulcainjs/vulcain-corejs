import { DefaultServiceNames, Inject } from './../di/annotations';
import { IContainer } from './../di/resolvers';
import { System } from './../globals/system';
import { DynamicConfiguration } from './../configurations/dynamicConfiguration';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { VulcainLogger } from '../log/vulcainLogger';
import { IServiceResolver } from '../globals/serviceResolver';
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
import { Span } from '../trace/span';


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
    private serviceName: string;
    private serviceVersion: string;
    private resolvedServiceName: string;

    @Inject(DefaultServiceNames.ServiceResolver)
    serviceResolver: IServiceResolver;
    protected tracer: Span;

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
        let dep = this.constructor["$dependency:service"];
        if (!dep) {
            throw new Error("ServiceDependency annotation is required on command " + Object.getPrototypeOf(this).constructor.name);
        }
        System.manifest.registerService(dep.targetServiceName, dep.targetServiceVersion);
        this.serviceName = dep.serviceName;
        this.serviceVersion = dep.serviceVersion;
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

    protected setMetricTags(targetServiceName: string, targetServiceVersion: string) {
        this.tracer.addTags({ targetServiceName: targetServiceName, targetServiceVersion: targetServiceVersion });
    }

    async getServiceName() {
        if (!this.resolvedServiceName) {
            this.resolvedServiceName = await this.createServiceName();
        }
        return this.resolvedServiceName;
    }

    private async createServiceName() {

        let alias = System.resolveAlias(this.serviceName, this.serviceVersion);
        if (alias)
            return alias;

        if (System.isDevelopment) {
            try {
                let deps = System.manifest.dependencies.services.find(svc => svc.service === this.serviceName && svc.version === this.serviceVersion);
                if (deps && deps.discoveryAddress) {
                    const url = URL.parse(deps.discoveryAddress);
                    return url.host;
                }
            }
            catch (e) {/*ignore*/ }
        }

        return await this.serviceResolver.resolveAsync(this.serviceName, this.serviceVersion);
    }

    /**
     * get a domain element
     * @param id - Element id
     * @param schema - optional element schema
     * @returns {Promise<QueryResponse<T>>}
     */
    protected async getRequestAsync<T>(id: string, args?, schema?: string): Promise<QueryResult> {
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(this.serviceName, this.serviceVersion, schema ? schema + ".get" : "get", { id });
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for ${this.serviceName}`);
            return result;
        }

        let service = await this.getServiceName();
        let url = System.createUrl(`http://${service}`, 'api', schema, 'get', id, args);
        this.tracer.setAction("get");
        let res = this.sendRequestAsync("get", url);
        return res;
    }

    /**
     *
     *
     * @protected
     * @template T
     * @param {string} action
     * @param {*} [query]
     * @param {number} [page]
     * @param {number} [maxByPage]
     * @param {string} [schema]
     * @returns {Promise<QueryResponse<T>>}
     */
    protected async getQueryAsync<T>(verb: string, query?: any, args?, page?: number, maxByPage?: number, schema?: string): Promise<QueryResult> {
        let data: any = {};
        data.$maxByPage = maxByPage;
        data.$page = page;
        data.$query = query && JSON.stringify(query);
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(this.serviceName, this.serviceVersion, verb, data);
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for (${verb}) ${this.serviceName}`);
            return result;
        }

        let service = await this.getServiceName();
        let url = System.createUrl(`http://${service}/api/${verb}`, args, data);
        this.tracer.setAction("Query");

        let res = this.sendRequestAsync("get", url);
        return res;
    }

    /**
     *
     *
     * @protected
     * @param {string} action
     * @param {*} data
     * @returns {Promise<ActionResponse<T>>}
     */
    protected async sendActionAsync<T>(verb: string, data: any, args?): Promise<ActionResult> {
        let command = { params: data, correlationId: this.requestContext.correlationId };
        const mocks=System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(this.serviceName, this.serviceVersion, verb, data);
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for (${verb}) ${this.serviceName}`);
            return result;
        }

        let service = await this.getServiceName();
        let url = System.createUrl(`http://${service}`, 'api', verb, args);
        this.tracer.setAction(verb);
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

        this.tracer.injectHeaders(request.header);

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

    protected async exec(kind: string, verb: string, userContext, data, args, page, maxByPage): Promise<any> {
        switch (kind) {
            case 'action': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.sendActionAsync(verb, data, args);
                return response.value;
            }
            case 'query': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.getQueryAsync(verb, data, args, page, maxByPage);
                return response.value;
            }
            case 'get': {
                userContext && this.setRequestContext(userContext.apiKey, userContext.tenant);
                let response = await this.getRequestAsync(data, args);
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