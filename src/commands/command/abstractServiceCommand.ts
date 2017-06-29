import { DefaultServiceNames, Inject } from './../../di/annotations';
import { IContainer } from './../../di/resolvers';
import { QueryResponse } from './../../pipeline/query';
import { ActionResponse } from './../../pipeline/actions';
import * as types from './types';
import * as os from 'os';
import 'reflect-metadata';
import { CommonRequestResponse } from '../../pipeline/common';
import { System } from './../../configurations/globals/system';
import { DynamicConfiguration } from './../../configurations/dynamicConfiguration';
import { ApplicationRequestError } from './../../errors/applicationRequestError';
import { IMetrics, MetricsConstant } from '../../metrics/metrics';
import { RequestContext } from '../../servers/requestContext';
import { ITokenService } from '../../defaults/services';
import { VulcainHeaderNames } from '../../servers/abstractAdapter';
import { HttpCommandError } from '../../errors/httpCommandError';
import { VulcainLogger } from '../../configurations/log/vulcainLogger';
const rest = require('unirest');
import { IServiceResolver } from '../../configurations/globals/serviceResolver';
import * as URL from 'url';

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

    @Inject(DefaultServiceNames.ServiceResolver)
    serviceResolver: IServiceResolver;

    /**
     *
     *
     * @type {RequestContext}
     */
    public requestContext: RequestContext;

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
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.logAction(this.requestContext, "BC", "Service", `Command: ${Object.getPrototypeOf(this).constructor.name} Calling service ${targetServiceName}, version: ${targetServiceVersion}`);
            this.requestContext.setCommand(`Call service ${targetServiceName} version ${targetServiceVersion}`);
        }
    }

    onCommandCompleted(duration: number, success: boolean) {
        this.metrics.timing(AbstractServiceCommand.METRICS_NAME + MetricsConstant.duration, duration, this.customTags);
        if (!success)
            this.metrics.increment(AbstractServiceCommand.METRICS_NAME + MetricsConstant.failure, this.customTags);
        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
        logger.logAction(this.requestContext, 'EC', 'Service', `Command: ${Object.getPrototypeOf(this).constructor.name} completed with ${success ? 'success' : 'error'}`);
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
    protected async getRequestAsync<T>(serviceName: string, version: string, id: string, args?, schema?: string): Promise<QueryResponse<T>> {
        const mocks = System.getMocks(this.container);
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
    protected async getQueryAsync<T>(serviceName: string, version: string, verb: string, query?: any, args?, page?: number, maxByPage?: number, schema?: string): Promise<QueryResponse<T>> {
        let data: any = {};
        data.$maxByPage = maxByPage;
        data.$page = page;
        data.$query = query && JSON.stringify(query);
        const mocks = System.getMocks(this.container);
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
    protected async sendActionAsync<T>(serviceName: string, version: string, verb: string, data: any, args?): Promise<ActionResponse<T>> {
        let command = { params: data, correlationId: this.requestContext.correlationId };
        const mocks = System.getMocks(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockServiceAsync(serviceName, version, verb, command);
        if (result !== undefined) {
            System.log.info(this.requestContext, ()=>`Using mock database result for (${verb}) ${serviceName}`);
            return result;
        }
        let url = System.createUrl(`http://${await this.createServiceName(serviceName, version)}`, 'api', verb, args);
        let res = <any>this.sendRequestAsync("post", url, (req) => req.json(command));
        return res;
    }

    private async setUserContextAsync(request: types.IHttpCommandRequest) {
        request.header(VulcainHeaderNames.X_VULCAIN_TENANT, this.overrideTenant || this.requestContext.tenant);

        if (this.overrideAuthorization) {
            request.header("Authorization", this.overrideAuthorization);
            return;
        }

        let token = this.requestContext.bearer;
        if (!token) {
            if (!this.requestContext.user) {
                return;
            }
            let tokens = this.requestContext.container.get<ITokenService>(DefaultServiceNames.TokenService);
            // Ensures jwtToken exists for user context propagation
            let result: any = await tokens.createTokenAsync(this.requestContext.user);
            token = result.token;
            this.requestContext.bearer = token;
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

        // Propagate context
        request.header(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, this.requestContext.correlationId);
        request.header(VulcainHeaderNames.X_VULCAIN_PARENT_ID, this.requestContext.traceId);
        request.header(VulcainHeaderNames.X_VULCAIN_SERVICE_NAME, System.serviceName);
        request.header(VulcainHeaderNames.X_VULCAIN_SERVICE_VERSION, System.serviceVersion);
        request.header(VulcainHeaderNames.X_VULCAIN_ENV, System.environment);
        request.header(VulcainHeaderNames.X_VULCAIN_CONTAINER, os.hostname());
        if (this.requestContext.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK]) {
            request.header(VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK, this.requestContext.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK]);
        }
        if (this.requestContext.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK]) {
            request.header(VulcainHeaderNames.X_VULCAIN_USE_MOCK, this.requestContext.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK]);
        }

        await this.setUserContextAsync(request);

        prepareRequest && prepareRequest(request);

        this.requestContext.logInfo(()=>"Calling vulcain service on " + url);
        return new Promise<CommonRequestResponse<any>>((resolve, reject) => {
            try {
                request.end((response: types.IHttpCommandResponse) => {
                    if (response.error || response.status !== 200) {
                        let err = new Error(response.error ? response.error.message : response.body);
                        System.log.error(this.requestContext, err, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(err);
                        return;
                    }
                    let vulcainResponse = response.body;
                    if (vulcainResponse.error) {
                        System.log.info(this.requestContext, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(new ApplicationRequestError(vulcainResponse.error.message, vulcainResponse.error.errors, response.status));
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
                reject(new HttpCommandError(msg, err));
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
