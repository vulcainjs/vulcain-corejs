var rest = require('unirest');
import * as types from './types';
import * as os from 'os';
import {DynamicConfiguration, IDynamicProperty, Logger} from '@sovinty/vulcain-configurations'
import {ExecutionResult} from './executionResult'
import {Schema} from '../../schemas/schema';
import {IProvider} from '../../providers/provider';
import {DefaultServiceNames} from '../../application';
import {IContainer} from '../../di/resolvers';
import {Domain} from '../../schemas/schema';
import {Inject} from '../../di/annotations';

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
}

export abstract class AbstractCommand<T> {
    private _localProxy: string;
    public context:ICommandContext;
    provider: IProvider<any>;
    schema: Schema;

    constructor( @Inject("Container") protected container: IContainer) { }

    initializeProvider(schema: string) {
        this.provider = this.container.get<IProvider<any>>(DefaultServiceNames.Provider);
        this.schema = this.container.get<Domain>(DefaultServiceNames.Domain).getSchema(schema);
        this.provider.initializeWithSchema(this.schema);
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

    /**
     * send a http get request
     * @param serviceId
     * @param version
     * @param urlSegments
     * @returns {Promise<types.IHttpResponse>}
     */
    protected getRequestAsync(serviceName: string, port: number, domain:string, id:string) {
        let command = { action: "get", data: {id:id}, correlationId: this.context.correlationId };
        let url = `http://${serviceName}:${port}/api/${domain}/${id}`;
        return this.sendRequestAsync("get", url, (req) => req.json(command));
    }

    protected getQueryAsync(serviceName: string, port: number, domain:string, query:any, action?:string) {
        let command = { action: action, data: query, correlationId: this.context.correlationId };
        let url = `http://${serviceName}:${port}/api/${domain}`;
        return this.sendRequestAsync("get", url, (req) => req.json(command));
    }

    protected postActionAsync(serviceName: string, port: number, domain: string, action: string, data: any) {
        let command = { action: action, data: data, correlationId: this.context.correlationId };
        let url = `http://${serviceName}:${port}/api/${domain}`;
        return this.sendRequestAsync("post", url, (req) => req.json(command));
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

    protected createUrl(url: string, ...urlSegments: Array<string|any>);
    protected createUrl(number: number|string, version?: string, ...urlSegments: Array<string|any>) {

        let baseurl: string;
        if (typeof number === "string")
        {
            baseurl = number; //url
            urlSegments = <any>version;
            if(!baseurl)
                throw new Error("base url must not be null");
        }
        else if (!version)
            throw new Error("Version is required");
        else
            baseurl = ["http://", DynamicConfiguration.localProxy, ":", number, '/api/', version, "/"].join("");

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
                        baseurl = baseurl.concat(sep, p, '=', encodeURIComponent( obj[p]));
                        sep = '&';
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