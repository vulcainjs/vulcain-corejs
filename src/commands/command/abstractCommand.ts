var rest = require('unirest');
import * as types from './types';
import * as os from 'os';
import {DynamicConfiguration, IDynamicProperty, Logger} from 'vulcain-configurationsjs'
import {ExecutionResult} from './executionResult'
import {Schema} from '../../schemas/schema';
import {IProvider} from '../../providers/provider';
import {DefaultServiceNames} from '../../application';
import {IContainer} from '../../di/resolvers';
import {Domain} from '../../schemas/schema';
import {Inject} from '../../di/annotations';
import {Pipeline} from '../../servers/requestContext';
import {ActionResponse} from '../../pipeline/actions';
import {QueryResponse} from '../../pipeline/query';
import {ValidationError, ErrorResponse} from '../../pipeline/common';

export class ApplicationRequestError extends Error {
    private errors: Array<ValidationError>;

    constructor(error: ErrorResponse) {
        super((error && error.message) || "Unknow error");
        this.errors = error && error.errors;
    }
}

/**
 * command
 */
export interface ICommand {
    /**
     * execute the command
     * @param args
     */
    executeAsync<T>(...args): Promise<T>;
    /**
     * execution result
     */
    status: ExecutionResult;
}

export interface ICommandContext {
    user;
    hasScope(scope: string): boolean;
    isAdmin(): boolean;
    getCommand(name: string): ICommand;
    correlationId: string;
    cache: Map<string, any>;
    logger: Logger;
    pipeline: Pipeline;
}

export abstract class AbstractCommand<T> {
    private _localProxy: string;
    public context:ICommandContext;
    provider: IProvider<any>;
    schema: Schema;

    constructor( @Inject("Container") protected container: IContainer) { }

    setSchema(schema: string) {
        if (schema && !this.provider) {
            this.provider = this.container.get<IProvider<any>>(DefaultServiceNames.Provider);
            this.schema = this.container.get<Domain>(DefaultServiceNames.Domain).getSchema(schema);
            this.provider.initializeWithSchema(this.schema);
        }
    }

    /**
     * log always
     * @param msg message or error
     */
    protected log(...msg: Array<string | Error>) {
        let message = (<Array<string>>msg.filter(m => typeof m === "string")).join(" ");
        let errors = (<Array<Error>>msg.filter(m => m instanceof Error));
        this.context.logger.log(message, errors && errors[0], this.context);
    }

    /**
     * log only if enabledLog dynamic property is set to true
     * @param msg
     */
    protected logInfo(...msg: Array<string|Error>) {
        let message = (<Array<string>>msg.filter(m => typeof m === "string")).join(" ");
        let errors = (<Array<Error>>msg.filter(m => m instanceof Error));
        this.context.logger.info(message, errors && errors[0], this.context);    }

    private createServiceName(serviceName: string, version: number) {
        return serviceName + version;
    }

    /**
     * send a http get request
     * @param serviceId
     * @param version
     * @param urlSegments
     * @returns {Promise<types.IHttpResponse>}
     */
    protected async getRequestAsync<T>(serviceName: string, version: number, domain:string, id:string, schema?:string): Promise<QueryResponse<T>> {
        let url = schema ? `http://${this.createServiceName(serviceName, version)}/api/${domain}/${schema}/${id}`
                         : `http://${this.createServiceName(serviceName, version)}/api/${domain}/${id}`;

        let res = await this.sendRequestAsync("get", url);
        let data: QueryResponse<T> = JSON.parse(res.body);
        if (res.status !== 200)
            throw new ApplicationRequestError(data.error);
        return data;
    }

    protected async getQueryAsync<T>(serviceName: string, version: number, domain:string, action:string, query?:any, page?:number, maxByPage?:number, schema?:string): Promise<QueryResponse<T>> {
        query = query || {};
        query.$action = action;
        query.$maxByPage = maxByPage;
        query.$page = page;
        query.$schema = schema;
        let url = this.createUrl(`http://${this.createServiceName(serviceName, version)}/api/${domain}`, query);

        let res = await this.sendRequestAsync("get", url);
        let data: QueryResponse<T> = JSON.parse(res.body);
        if (res.status !== 200 || data.error)
            throw new ApplicationRequestError(data.error);
        return data;
    }

    protected async postActionAsync(serviceName: string, version: number, domain: string, action: string, data: any): Promise<ActionResponse<T>> {
        let command = { action: action, data: data, correlationId: this.context.correlationId };
        let url = `http://${this.createServiceName(serviceName, version)}/api/${domain}`;

        let res = await this.sendRequestAsync("post", url, (req) => req.json(command));
        let result: ActionResponse<T> = JSON.parse(res.body);
        if (res.status !== 200 || result.status === "Error")
            throw new ApplicationRequestError(data.error);
        return result;
    }

    protected sendRequestAsync(verb:string, url:string, prepareRequest?:(req:types.IHttpRequest) => void) {
        let request: types.IHttpRequest = rest[verb](url);
        request.header("X-VULCAIN-CORRELATION-ID", this.context.correlationId);
        request.header("X-VULCAIN-SERVICE-NAME", DynamicConfiguration.serviceName);
        request.header("X-VULCAIN-SERVICE-VERSION", DynamicConfiguration.serviceVersion);
        request.header("X-VULCAIN-CLUSTER", DynamicConfiguration.clusterName);
        request.header("X-VULCAIN-CONTAINER", os.hostname());

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

    protected createUrl(baseurl: string, ...urlSegments: Array<string|any>) {

        if (urlSegments) {
            if( baseurl[baseurl.length-1] !== "/")
                baseurl += "/";

            baseurl += urlSegments.filter((s: any) => typeof s === 'string').map((s: string) => encodeURIComponent(s)).join('/');
            var query = urlSegments.filter((s: any) => typeof s !== 'string');
            if (query.length) {
                var sep = '?';
                query.forEach((obj: any) => {
                    for (var p in obj ) {
                        if ( !obj.hasOwnProperty(p) ) {
                            continue;
                        }
                        if (obj[p]) {
                            baseurl = baseurl.concat(sep, p, '=', encodeURIComponent(obj[p]));
                            sep = '&';
                        }
                    }
                });
            }
            return baseurl;
        } else {
            return baseurl;
        }
    }

    /**
     * execute command
     */
    protected abstract runAsync(...args): Promise<T>;

    // Must be defined in command
   // protected fallbackAsync(err, ...args)
}