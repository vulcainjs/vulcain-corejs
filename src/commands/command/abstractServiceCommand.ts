import { DefaultServiceNames, Inject } from './../../di/annotations';
import { IContainer } from './../../di/resolvers';
import { System, DynamicConfiguration } from 'vulcain-configurationsjs';
import { QueryResponse } from './../../pipeline/query';
import { ApplicationRequestError, ICommandContext } from './abstractCommand';
import { ActionResponse } from './../../pipeline/actions';
import * as types from './types';
import * as os from 'os';
var rest = require('unirest');

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T
 */
export abstract class AbstractServiceCommand {
    /**
     *
     *
     * @type {ICommandContext}
     */
    public context:ICommandContext;

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor( @Inject(DefaultServiceNames.Container) protected container: IContainer, @Inject(DefaultServiceNames.ProviderFactory) private providerFactory) { }

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

        if (System.isDevelopment) {
            let alias = System.resolveAlias(serviceName, version);
            if (alias)
                return alias;
        }

        // Check if there is a service $redirect config property in shared properties
        // Consul = shared/$redirect/serviceName-version
        let name = `$redirect.${serviceName}-${version}`;
        let prop = DynamicConfiguration.getProperty<any>(name);
        if (prop && prop.value) {
            if (prop.value.serviceName && !prop.value.version) return prop.value;
            serviceName = prop.value.serviceName || serviceName;
            version = prop.value.version || version;
        }

        return (serviceName + version).replace(/[\.-]/g, '').toLowerCase();
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
    protected async getRequestAsync<T>(serviceName: string, version: string, id:string, schema?:string): Promise<QueryResponse<T>> {
        let url = schema ? `http://${this.createServiceName(serviceName, version)}/api/{schema}/get/${id}`
                         : `http://${this.createServiceName(serviceName, version)}/api/get/${id}`;

        let res = await this.sendRequestAsync("get", url);
        let data: QueryResponse<T> = JSON.parse(res.body);
        if (res.status !== 200)
            throw new ApplicationRequestError(data.error);
        return data;
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
    protected async getAllAsync<T>(serviceName: string, version: string, action:string, query?:any, page?:number, maxByPage?:number, schema?:string): Promise<QueryResponse<T>> {
        query = query || {};
        query.$action = action;
        query.$maxByPage = maxByPage;
        query.$page = page;
        query.$schema = schema;
        let url = System.createUrl(`http://${this.createServiceName(serviceName, version)}/api`, { $query: JSON.stringify(query) });

        let res = await this.sendRequestAsync("get", url);
        let data: QueryResponse<T> = JSON.parse(res.body);
        if (res.status !== 200 || data.error)
            throw new ApplicationRequestError(data.error);
        return data;
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
    protected async getQueryAsync<T>(serviceName: string, version: string, action:string, query?:any, page?:number, maxByPage?:number, schema?:string): Promise<QueryResponse<T>> {
        query = query || {};
        query.$action = action;
        query.$maxByPage = maxByPage;
        query.$page = page;
        query.$schema = schema;
        let url = System.createUrl(`http://${this.createServiceName(serviceName, version)}/api`, query);

        let res = await this.sendRequestAsync("get", url);
        let data: QueryResponse<T> = JSON.parse(res.body);
        if (res.status !== 200 || data.error)
            throw new ApplicationRequestError(data.error);
        return data;
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
    protected async sendActionAsync<T>(serviceName: string, version: string, action: string, data: any): Promise<ActionResponse<T>> {
        let command = { action: action, data: data, correlationId: this.context.correlationId };
        let url = `http://${this.createServiceName(serviceName, version)}/api`;

        let res = await this.sendRequestAsync("post", url, (req) => req.json(command));
        let result: ActionResponse<T> = JSON.parse(res.body);
        if (res.status !== 200 || result.status === "Error")
            throw new ApplicationRequestError(data.error);
        return result;
    }

    private calculateRequestPath() {
        if (this.context.correlationId[this.context.correlationId.length - 1] === "-")
            this.context.correlationPath += "1";
        else {
            let parts = this.context.correlationPath.split('-');
            let ix = parts.length - 1;
            let nb = parseInt(parts[ix]) + 1;
            parts[ix] = nb.toString();
            this.context.correlationPath = parts.join('-');
        }

        return this.context.correlationPath;
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
    protected sendRequestAsync(verb:string, url:string, prepareRequest?:(req:types.IHttpRequest) => void) {
        let request: types.IHttpRequest = rest[verb](url);
        request.header("X-VULCAIN-CORRELATION-ID", this.context.correlationId);
        request.header("X-VULCAIN-CORRELATION-PATH", this.calculateRequestPath() + "-");
        request.header("X-VULCAIN-SERVICE-NAME", System.serviceName);
        request.header("X-VULCAIN-SERVICE-VERSION", System.serviceVersion);
        request.header("X-VULCAIN-ENV", System.environment);
        request.header("X-VULCAIN-CONTAINER", os.hostname());
        request.header("X-VULCAIN-TENANT", this.context.tenant);

        prepareRequest && prepareRequest(request);

        return new Promise<types.IHttpResponse>((resolve, reject) => {
            try {
                request.end((response) => {
                    if (response.error)
                        reject(response.error);
                    else
                        resolve(response);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * execute command
     * @protected
     * @abstract
     * @param {any} args
     * @returns {Promise<T>}
     */
    protected abstract runAsync(...args): Promise<any>;

    // Must be defined in command
   // protected fallbackAsync(err, ...args)
}
