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
const rest = require('unirest');

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T
 */
export abstract class AbstractServiceCommand {
    protected metrics: IMetrics;
    /**
     *
     *
     * @type {RequestContext}
     */
    public requestContext: RequestContext;

    get container() {
        return this.requestContext.container;
    }

    private static METRICS_NAME = "service_call_";

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor( @Inject(DefaultServiceNames.Container) container: IContainer) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);
        this.initializeMetricsInfo();
    }

    protected initializeMetricsInfo() {
        let dep = this.constructor["$dependency:service"];
        if (!dep) {
            throw new Error("ServiceDependency annotation is required on command "  + Object.getPrototypeOf(this).name);
        }
        this.setMetricsTags(dep.service, dep.version);
    }

    protected setMetricsTags(targetServiceName: string, targetServiceVersion: string) {
        this.metrics.setTags("targetServiceName=" + targetServiceName, "targetServiceVersion=" + targetServiceVersion);
    }

    onCommandCompleted(duration: number, success: boolean) {
        this.metrics.timing(AbstractServiceCommand.METRICS_NAME + MetricsConstant.duration, duration);
        this.metrics.increment(AbstractServiceCommand.METRICS_NAME + MetricsConstant.total);
        if (!success)
            this.metrics.increment(AbstractServiceCommand.METRICS_NAME + MetricsConstant.failure);
    }

    /**
     *
     *
     * @private
     * @param {string} serviceName
     * @param {number} version
     * @returns
     */
    private createServiceName(serviceName: string, version: string) {
        if (!serviceName)
            throw new Error("You must provide a service name");
        if (!version || !version.match(/[0-9]+\.[0-9]+/))
            throw new Error("Invalid version number. Must be on the form major.minor");

        if (System.isTestEnvironnment) {
            let alias = System.resolveAlias(serviceName, version);
            if (alias)
                return alias;
        }

        // Check if there is a service $redirect config property in shared properties
        // Consul = shared/$redirect/serviceName-version
        let name = `$redirect.${serviceName}-${version}`;
        let prop = DynamicConfiguration.getProperty<any>(name);
        if (prop && prop.value) {
            if (!prop.value.serviceName && !prop.value.version) return prop.value;
            serviceName = prop.value.serviceName || serviceName;
            version = prop.value.version || version;
        }

        return (serviceName + version).replace(/[\.-]/g, '').toLowerCase() + ":8080";
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
    protected getRequestAsync<T>(serviceName: string, version: string, id: string, schema?: string): Promise<QueryResponse<T>> {
        let url = schema ? `http://${this.createServiceName(serviceName, version)}/api/{schema}/get/${id}`
            : `http://${this.createServiceName(serviceName, version)}/api/get/${id}`;

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
    protected getQueryAsync<T>(serviceName: string, version: string, verb: string, query?: any, page?: number, maxByPage?: number, schema?: string): Promise<QueryResponse<T>> {
        let args: any = {};
        args.$maxByPage = maxByPage;
        args.$page = page;
        args.$query = query && JSON.stringify(query);
        let url = System.createUrl(`http://${this.createServiceName(serviceName, version)}/api/${verb}`, args);

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
    protected sendActionAsync<T>(serviceName: string, version: string, verb: string, data: any): Promise<ActionResponse<T>> {
        let command = { params: data, correlationId: this.requestContext.correlationId };
        let url = `http://${this.createServiceName(serviceName, version)}/api/${verb}`;

        let res = this.sendRequestAsync("post", url, (req) => req.json(command));
        return res;
    }

    private calculateRequestPath() {
        if (this.requestContext.correlationId[this.requestContext.correlationId.length - 1] === "-")
            this.requestContext.correlationPath += "1";
        else {
            let parts = this.requestContext.correlationPath.split('-');
            let ix = parts.length - 1;
            let nb = (parseInt(parts[ix]) || 0) + 1;
            parts[ix] = nb.toString();
            this.requestContext.correlationPath = parts.join('-');
        }

        return this.requestContext.correlationPath;
    }

    private async getBearerToken() {
        let token = this.requestContext.bearer;
        if (token) {
            return token;
        }

        let tokens = this.requestContext.container.get<ITokenService>("TokenService");
        // Ensures jwtToken exists for user context propagation
        let result:any = this.requestContext.bearer = await tokens.createTokenAsync(this.requestContext.user);
        return result.token;
    }

    /**
     * Send a http request
     *
     * @protected
     * @param {string} http verb to use
     * @param {string} url
     * @param {(req:types.IHttpRequest) => void} [prepareRequest] Callback to configure request before sending
     * @returns request response
     */
    protected async sendRequestAsync(verb: string, url: string, prepareRequest?: (req: types.IHttpRequest) => void) {
        let request: types.IHttpRequest = rest[verb](url);

        // Propagate context
        request.header("X-VULCAIN-CORRELATION-ID", this.requestContext.correlationId);
        request.header("X-VULCAIN-CORRELATION-PATH", this.calculateRequestPath() + "-");
        request.header("X-VULCAIN-SERVICE-NAME", System.serviceName);
        request.header("X-VULCAIN-SERVICE-VERSION", System.serviceVersion);
        request.header("X-VULCAIN-ENV", System.environment);
        request.header("X-VULCAIN-CONTAINER", os.hostname());
        request.header("X-VULCAIN-TENANT", this.requestContext.tenant);
        request.header("Authorization", "Bearer " + await this.getBearerToken());

        prepareRequest && prepareRequest(request);

        this.requestContext.logInfo("Calling vulcain service on " + url);
        return new Promise<CommonRequestResponse<any>>((resolve, reject) => {
            try {
                request.end((response: types.IHttpResponse) => {
                    if (response.error || response.status !== 200) {
                        let err = new Error(response.error ? response.error.message : response.body);
                        System.log.error(this.requestContext, err, `Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(err);
                        return;
                    }
                    let vulcainResponse = response.body;
                    if (vulcainResponse.error) {
                        System.log.info(this.requestContext, `Service request ${verb} ${url} failed with status code ${response.status}`);
                        reject(new ApplicationRequestError(vulcainResponse.error.message, vulcainResponse.error.errors, response.status));
                    }
                    else {
                        System.log.info(this.requestContext, `Service request ${verb} ${url} completed with status code ${response.status}`);
                        resolve(vulcainResponse);
                    }
                });
            }
            catch (err) {
                System.log.error(this.requestContext, err, `Service request ${verb} ${url} failed`);
                reject(err);
            }
        });
    }

    protected async exec(kind: string, serviceName: string, version: string, verb: string, data, page, maxByPage): Promise<any> {
        switch (kind) {
            case 'action': {
                let response = await this.sendActionAsync(serviceName, version, verb, data);
                return response.value;
            }
            case 'query': {
                let response = await this.getQueryAsync(serviceName, version, verb, data, page, maxByPage);
                return { values: response.value, total: response.total, page };
            }
            case 'get': {
                let response = await this.getRequestAsync(serviceName, version, data);
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
