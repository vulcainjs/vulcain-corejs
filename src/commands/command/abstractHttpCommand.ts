const rest = require('unirest');
import * as types from './types';
import { ICommandContext } from './abstractCommand';
import { DefaultServiceNames, Inject } from './../../di/annotations';
import { IContainer } from './../../di/resolvers';
import { System } from './../../configurations/globals/system';
import { IMetrics } from '../../metrics/metrics';
import { ExternalDependencyInfo } from '../../configurations/dependencies/annotations';

export abstract class AbstractHttpCommand {
    protected metrics: IMetrics;
    public requestContext: ICommandContext;
    private static METRICS_NAME = "External_Call_";

    constructor(@Inject(DefaultServiceNames.Container) protected container: IContainer) {
        this.metrics = this.container.get<IMetrics>(DefaultServiceNames.Metrics);
        this.initializeMetricsInfo();
    }

    protected initializeMetricsInfo() {
        let dep = this.constructor["$dependency:external"];
        if (!dep) {
            throw new Error("HttpDependency annotation is required.")
        }
        this.metrics.setTags("uri=" + dep.uri);
    }

    onCommandCompleted(duration: number, success: boolean) {
        this.metrics.timing(AbstractHttpCommand.METRICS_NAME + "Duration", duration);
        this.metrics.increment(AbstractHttpCommand.METRICS_NAME + "Total");
        if (!success)
            this.metrics.increment(AbstractHttpCommand.METRICS_NAME + "Failed");
    }

    runAsync(...args): Promise<any> {
        return (<any>this).execAsync(...args);
    }

    protected async execAsync(verb:string, url:string, data? ): Promise<any> {
        let method = this[verb + "Async"];
        if (!method)
            throw new Error(`${verb} is not implemented in AbstractHttpCommand. Use a custom command for this verb.`);
        return await method(url, data)
    }

    protected postAsync(url: string, data) {
        return this.sendRequestAsync('post', url, req => req.json(data));
    }

    protected getAsync(url: string) {
        return this.sendRequestAsync('get', url);
    }

    protected deleteAsync(url: string) {
        return this.sendRequestAsync('delete', url);
    }

    protected putAsync(url: string, data) {
        return this.sendRequestAsync('put', url, req => req.json(data));
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

        prepareRequest && prepareRequest(request);

        return new Promise<types.IHttpResponse>((resolve, reject) => {
            try {
                request.end((response) => {
                    if (response.status >= 500) {
                        System.log.info(this.requestContext, `Http request ${verb} ${url} failed with status code ${response.status}`)
                        reject(response.error);
                    }
                    else {
                        System.log.info(this.requestContext, `Http request ${verb} ${url} completed with status code ${response.status}`)
                        resolve(response);
                    }
                });
            }
            catch (err) {
                System.log.error(this.requestContext, err, `Error on http request ${verb} ${url}`)
                reject(err);
            }
        });
    }
}