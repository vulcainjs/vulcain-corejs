const rest = require('unirest');
import * as types from './types';
import { DefaultServiceNames, Inject } from './../../di/annotations';
import { IContainer } from './../../di/resolvers';
import { System } from './../../configurations/globals/system';
import { IMetrics, MetricsConstant } from '../../metrics/metrics';
import { RequestContext } from '../../servers/requestContext';

export abstract class AbstractHttpCommand {
    protected metrics: IMetrics;
    public requestContext: RequestContext;
    private static METRICS_NAME = "external_call";

    get container() {
        return this.requestContext.container;
    }

    constructor( @Inject(DefaultServiceNames.Container) container: IContainer) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);
        this.initializeMetricsInfo();
    }

    protected initializeMetricsInfo() {
        let dep = this.constructor["$dependency:external"];
        if (!dep) {
            throw new Error("HttpDependency annotation is required on command " + Object.getPrototypeOf(this).name);
        }
        this.setMetricsTags(dep.uri);
    }

    /**
     * Set metric tags for this command
     *
     * @protected
     * @param {any} tags
     *
     * @memberOf AbstractHttpCommand
     */
    protected setMetricsTags(uri: string) {
        if (!uri)
            throw new Error("Metrics tags must have an uri property.");
        let exists = System.manifest.dependencies.externals.find(ex => ex.uri === uri);
        if (!exists) {
            System.manifest.dependencies.externals.push({ uri });
        }
        this.metrics.setTags("uri=" + uri);
    }

    onCommandCompleted(duration: number, success: boolean) {
        this.metrics.timing(AbstractHttpCommand.METRICS_NAME + MetricsConstant.duration, duration);
        if (!success)
            this.metrics.increment(AbstractHttpCommand.METRICS_NAME + MetricsConstant.failure);
    }

    runAsync(...args): Promise<any> {
        return (<any>this).execAsync(...args);
    }

    protected async execAsync(verb: string, url: string, data?): Promise<any> {
        let method = this[verb + "Async"];
        if (!method)
            throw new Error(`${verb} is not implemented in AbstractHttpCommand. Use a custom command for this verb.`);
        return await method(url, data);
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
    protected sendRequestAsync(verb: string, url: string, prepareRequest?: (req: types.IHttpRequest) => void) {
        let request: types.IHttpRequest = rest[verb](url);

        prepareRequest && prepareRequest(request);

        return new Promise<types.IHttpResponse>((resolve, reject) => {
            try {
                request.end((response) => {
                    if (response.status >= 500) {
                        System.log.info(this.requestContext, `Http request ${verb} ${url} failed with status code ${response.status}`);
                        reject(response.error);
                    }
                    else {
                        System.log.info(this.requestContext, `Http request ${verb} ${url} completed with status code ${response.status}`);
                        resolve(response);
                    }
                });
            }
            catch (err) {
                System.log.error(this.requestContext, err, `Error on http request ${verb} ${url}`);
                reject(err);
            }
        });
    }
}