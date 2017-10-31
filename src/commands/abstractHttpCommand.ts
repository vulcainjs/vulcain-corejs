const rest = require('unirest');
import * as types from './types';
import { DefaultServiceNames, Inject } from './../di/annotations';
import { IContainer } from './../di/resolvers';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { System } from '../globals/system';
import { VulcainLogger } from '../log/vulcainLogger';
import { HttpCommandError } from "./abstractServiceCommand";
import { IRequestContext } from "../pipeline/common";
import { Span } from '../trace/span';


export abstract class AbstractHttpCommand {
    public context: IRequestContext;
    private static METRICS_NAME = "external_call";

    constructor( @Inject(DefaultServiceNames.Container) public container: IContainer) {
        let dep = this.constructor["$dependency:external"];
        if (dep) {
            this.setMetricTags(null, dep.uri);
        }
    }

    /**
     * Set metric tags for this command
     *
     * @protected
     * @param {any} tags
     *
     * @memberOf AbstractHttpCommand
     */

    protected setMetricTags(verb: string, uri: string) {
        if (!uri)
            throw new Error("Metrics tags must have an uri property.");
        uri = System.removePasswordFromUrl(uri);
        System.manifest.registerExternal(uri);

        if(uri && verb)
            this.context.addTrackerTags({ uri: uri, verb: verb });
    }

    post(url: string, data) {
        return this.sendRequest('post', url, req => req.json(data));
    }

    get(url: string) {
        return this.sendRequest('get', url);
    }

    delete(url: string) {
        return this.sendRequest('delete', url);
    }

    put(url: string, data) {
        return this.sendRequest('put', url, req => req.json(data));
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

        this.context.trackAction(verb);
        this.setMetricTags(verb, url);

        const mocks = System.getMocksManager(this.container);
        let result = System.isDevelopment && mocks.enabled && await mocks.applyMockHttp(url, verb);
        if (result) {
            System.log.info(this.context, ()=>`Using mock output for (${verb}) ${System.removePasswordFromUrl(url)}`);
            return result;
        }

        let request: types.IHttpCommandRequest = rest[verb](url);

        prepareRequest && prepareRequest(request);
        System.log.info(this.context, ()=>`Calling (${verb}) ${System.removePasswordFromUrl(url)}`);

        return new Promise<types.IHttpCommandResponse>((resolve, reject) => {
            request.end((response) => {
                if (response.status >= 400) {
                    let msg = ()=> `Http request ${verb} ${url} failed with status code ${response.status}`;
                    System.log.info(this.context, msg);
                    reject(new HttpCommandError(msg(), response));
                    return;
                }

                if (response.error) {
                    let msg = ()=>`Error on http request ${verb} ${url} - ${response.error}`;
                    reject(this.handleError(msg, response.error));
                    return;
                }

                System.log.info(this.context, ()=>`Http request ${verb} ${url} completed succesfully (code:${response.status}).`);
                resolve(response);
            });
        });
    }

    private handleError(msg: ()=>string, err?) {
        System.log.error(this.context, err, msg);
        if (err && !(err instanceof Error)) {
            let tmp = err;
            err = new Error(msg());
            err.error = tmp;
        }
        return new HttpCommandError(msg(), err, 500);
    }
}