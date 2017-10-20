import { DefaultServiceNames, Inject } from './../di/annotations';
import { IContainer } from './../di/resolvers';
import { System } from './../globals/system';
import { DynamicConfiguration } from './../configurations/dynamicConfiguration';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { VulcainLogger } from '../log/vulcainLogger';
import { IServiceResolver } from '../di/serviceResolver';
import * as types from './types';
import 'reflect-metadata';
const rest = require('unirest');
import * as URL from 'url';
import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { IRequestContext } from "../pipeline/common";
import { ApplicationError } from "../pipeline/errors/applicationRequestError";
import { IAuthenticationStrategy } from "../security/securityContext";
import { QueryResult } from "../pipeline/handlers/query";
import { ActionResult } from "../pipeline/handlers/actions";
import { Span } from '../trace/span';
import { TokenService } from '../security/services/tokenService';


export class HttpCommandError extends ApplicationError {
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
 */
export abstract class AbstractServiceCommand {
    private overrideAuthorization: string;
    private overrideTenant: string;

    @Inject(DefaultServiceNames.ServiceResolver)
    serviceResolver: IServiceResolver;

    /**
     *
     *
     * @type {IRequestContext}
     */
    public context: IRequestContext;
    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor( @Inject(DefaultServiceNames.Container) public container: IContainer) {
    }

    protected setMetricTags(serviceName: string, serviceVersion: string) {
//        let dep = this.constructor["$dependency:service"];
//        if (dep) {
//            this.setMetricTags(dep.targetServiceName, dep.targetServiceVersion);
//        }

        this.context.addTrackerTags({ targetServiceName: serviceName, targetServiceVersion: serviceVersion });
        System.manifest.registerService(serviceName, serviceVersion);
    }

    /**
     * Set (or reset) user context to use for calling service.
     *
     * @protected
     * @param {string} authorization - null for reset
     * @param {string} tenant - null for reset
     *
     * @memberOf AbstractServiceCommand
     */
    protected setRequestContext(authorization?: string, tenant?: string) {
        if (!authorization) {
            this.overrideAuthorization = null;
        }
        else {
            this.overrideAuthorization = authorization;
        }
        this.overrideTenant = tenant;
    }

    private async createServiceName(serviceName: string, serviceVersion: string,) {
        this.setMetricTags(serviceName, serviceVersion);

        let alias = System.resolveAlias(serviceName, serviceVersion);
        if (alias)
            return alias;

        if (System.isDevelopment) {
            try {
                let deps = System.manifest.dependencies.services.find(svc => svc.service === serviceName && svc.version === serviceVersion);
                if (deps && deps.discoveryAddress) {
                    const url = URL.parse(deps.discoveryAddress);
                    return url.host;
                }
            }
            catch (e) {/*ignore*/ }
        }

        return await this.serviceResolver.resolve(serviceName, serviceVersion);
    }

    /**
     * get a domain element
     * @param id - Element id
     * @param schema - optional element schema
     * @returns {Promise<QueryResponse<T>>}
     */
    protected async getRequest<T>(serviceName: string, serviceVersion: string, id: string, args?, schema?: string): Promise<QueryResult> {
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockService(serviceName, serviceVersion, schema ? schema + ".get" : "get", { id });
        if (result !== undefined) {
            System.log.info(this.context, ()=>`Using mock database result for ${serviceName}`);
            return result;
        }

        let service = await this.createServiceName(serviceName, serviceVersion);
        let url = System.createUrl(`http://${service}`, 'api', schema, 'get', id, args);
        this.context.trackAction("get");
        let res = this.sendRequest("get", url);
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
    protected async getQuery<T>(serviceName: string, serviceVersion: string, verb: string, query?: any, args?, page?: number, maxByPage?: number, schema?: string): Promise<QueryResult> {
        let data: any = {};
        data.$maxByPage = maxByPage;
        data.$page = page;
        data.$query = query && JSON.stringify(query);
        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockService(serviceName, serviceVersion, verb, data);
        if (result !== undefined) {
            System.log.info(this.context, ()=>`Using mock database result for (${verb}) ${serviceName}`);
            return result;
        }

        let service = await this.createServiceName(serviceName, serviceVersion);
        let url = System.createUrl(`http://${service}/api/${verb}`, args, data);
        this.context.trackAction("Query");

        let res = this.sendRequest("get", url);
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
    protected async sendAction<T>(serviceName: string, serviceVersion: string, verb: string, data: any, args?): Promise<ActionResult> {
        let command = { params: data, correlationId: this.context.requestData.correlationId };
        const mocks=System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockService(serviceName, serviceVersion, verb, data);
        if (result !== undefined) {
            System.log.info(this.context, ()=>`Using mock database result for (${verb}) ${serviceName}`);
            return result;
        }

        let service = await this.createServiceName(serviceName, serviceVersion);
        let url = System.createUrl(`http://${service}`, 'api', verb, args);
        this.context.trackAction(verb);
        let res = <any>this.sendRequest("post", url, (req) => req.json(data));
        return res;
    }

    private async setUserContext(request: types.IHttpCommandRequest) {
        request.header(VulcainHeaderNames.X_VULCAIN_TENANT, this.overrideTenant || this.context.user.tenant);

        if (this.overrideAuthorization) {
            request.header("Authorization", this.overrideAuthorization);
            return;
        }

        let ctx = this.context as RequestContext;
        let token = ctx.getBearerToken();
        if (!token) {
            if (this.context.user.isAnonymous) {
                return;
            }
            let tokens = new TokenService();
            // Ensures jwtToken exists for user context propagation
            let result: any = await tokens.createToken(this.context.user);
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
    protected async sendRequest(verb: string, url: string, prepareRequest?: (req: types.IHttpCommandRequest) => void) {

        let request: types.IHttpCommandRequest = rest[verb](url);

        let ctx = this.context as RequestContext;
        await this.setUserContext(request);

        this.context.injectHeaders(request.header);

        prepareRequest && prepareRequest(request);

        this.context.logInfo(()=>"Calling vulcain service on " + url);
        return new Promise<any>((resolve, reject) => {
            try {
                request.end((response: types.IHttpCommandResponse) => {
                    if (response.error || response.status !== 200) {
                        let err;
                        if (response.body) {
                            if (typeof response.body === "object") {
                                if (response.body.error) {
                                    let appError = response.body.error;
                                    err = new ApplicationError(appError.message, response.status, appError.errors);
                                }
                                else {
                                    err = new ApplicationError(response.body.message, response.status);
                                }
                            }
                            else {
                                err = new ApplicationError(response.body, response.status);
                            }
                        }
                        else {
                            err = new ApplicationError((response.error && response.error.message) || "Unknow error", response.status);
                        }
                        System.log.error(this.context, err, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(err);
                        return;
                    }
                    let vulcainResponse = response.body;
                    if (vulcainResponse.error) {
                        System.log.info(this.context, ()=>`Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(new ApplicationError(vulcainResponse.error.message, response.status, vulcainResponse.error.errors));
                    }
                    else {
                        System.log.info(this.context, ()=>`Service request ${verb} ${url} completed with status code ${response.status}`);
                        resolve(vulcainResponse);
                    }
                });
            }
            catch (err) {
                let msg = ()=>`Service request ${verb} ${url} failed`;
                System.log.error(this.context, err, msg);
                if (!(err instanceof Error)) {
                    let tmp = err;
                    err = new Error(msg());
                    err.error = tmp;
                }
                reject(new HttpCommandError(msg(), err));
            }
        });
    }

    async execGet<T>(serviceName: string, serviceVersion: string, userContext: any, data: any, args: any): Promise<T> {
        userContext && this.setRequestContext(userContext.authorization, userContext.tenant);
        let response = await this.getRequest(serviceName, serviceVersion, data, args);
        return response.value;
    }

    async execQuery<T>( serviceName: string, serviceVersion: string, userContext: any, verb: string, data: any, args: any, page: any, maxByPage: any): Promise<T> {
        userContext && this.setRequestContext(userContext.authorization, userContext.tenant);
        let response = await this.getQuery(serviceName, serviceVersion, verb, data, args, page, maxByPage);
        return response.value;
    }

    async execAction<T>( serviceName: string, serviceVersion: string, userContext: any, verb: string, data: any, args: any): Promise<T> {
        userContext && this.setRequestContext(userContext.authorization, userContext.tenant);
        let response = await this.sendAction(serviceName, serviceVersion, verb, data, args);
        return response.value;
    }

    // Must be defined in command
    //protected fallback(err, ...args);
}