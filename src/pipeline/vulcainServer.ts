import { IContainer } from '../di/resolvers';
import { Conventions } from '../utils/conventions';
import { Pipeline, IRequestContext, RequestData } from './common';
import { RequestContext, VulcainHeaderNames } from './requestContext';
import { DefaultServiceNames } from '../di/annotations';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { VulcainLogger } from '../log/vulcainLogger';
import http = require('http');
import url = require('url');
import { HystrixSSEStream as hystrixStream } from '../commands/http/hystrixSSEStream';
import { System } from "../globals/system";
import { VulcainPipeline, HttpRequest } from "./vulcainPipeline";
import { NormalizeDataMiddleware } from "./middlewares/normalizeDataMiddleware";
import { AuthenticationMiddleware } from "./middlewares/authenticationMiddleware";
import { MetricsMiddleware } from "./middlewares/metricsMiddleware";
import { HandlersMiddleware } from "./middlewares/handlersMiddleware";
import { HttpResponse } from "./response";
import Router = require('router');

export interface IServerAdapter {
    init(container: IContainer, pipeline: VulcainPipeline);
    startAsync(port: number, callback: (err) => void);
    registerRoute(verb: string, path: string, handler: (request: HttpRequest) => HttpResponse);
    registerNativeRoute(verb: string, path: string, handler: (request: http.IncomingMessage, res: http.ServerResponse) => void);
}

export class HttpAdapter implements IServerAdapter {
    private srv: http.Server;
    private router: Router;
    private container: IContainer;
    private vulcainPipe: VulcainPipeline;
    /**
     *
     */
    init( container: IContainer,  vulcainPipe: VulcainPipeline) {
        this.router = Router();
    }

    startAsync(port: number, callback: (err)=>void) {
        this.srv.listen(port,callback);

        this.srv = http.createServer((req, resp) => {
            // Actions and query
            // POST/GET /api/...
            if (req.url.startsWith(Conventions.instance.defaultUrlprefix) && (req.method === "GET" || req.method === "POST")) {
                this.processVulcainRequest(req, resp);
                return;
            }

            // Custom request
            if (req.method === "GET") {
                this.router(req, resp, () => { resp.statusCode = 404; resp.end(); });
                return;
            }

            resp.statusCode = 404;
            resp.end();
        });
    }

    private processVulcainRequest( req: http.IncomingMessage, resp: http.ServerResponse) {
        let request: HttpRequest = { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) }
        try {

            let body = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', async () => {
                request.body = req.method === "POST" && Buffer.concat(body).toString();
                let result = await this.vulcainPipe.process(this.container, request);
                this.sendResponse(resp, result);
            });
        }
        finally {
        }
    }

    private sendResponse(resp: http.ServerResponse, response: HttpResponse) {
        if (!response) {
            resp.end(); // TODO try to encapsulate all end responses into setImmediate
            return;
        }

        try {
            if (response.headers) {
                for (const k of Object.keys(response.headers)) {
                    resp.setHeader(k, response.headers[k]);
                }
            }

            resp.statusCode = response.statusCode || 200;
            resp.setHeader('Content-Type', response.contentType || "application/json");

            if (response.content) {
                if (response.encoding) {
                    resp.end(response.content, response.encoding);
                }
                else {
                    let str = typeof response.content === "string" ? response.content : JSON.stringify(response.content)
                    resp.end(str, "utf8");
                }
            }
            else {
                resp.end();
            }
        }
        catch (e) {
            console.log(e);
            try {
                resp.end();
            }
            catch (e) { }
        }
    }

    registerRoute(verb: string, path: string, handler: (request: HttpRequest) => HttpResponse) {
        this.router[verb](path, (req: http.IncomingMessage, res: http.ServerResponse) => {
            let request: HttpRequest = { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) }
            let result = handler(request);
            this.sendResponse(res, result);
        });
    }

    registerNativeRoute(verb: string, path: string, handler: (request: http.IncomingMessage, res: http.ServerResponse) => void) {
        this.router[verb](path, handler);
    }
}

export class VulcainServer {
    private metrics: IMetrics;
    private adapter: IServerAdapter;

    constructor(protected domainName: string, protected container: IContainer, private enableHystrixStream=false) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);

        this.adapter = this.container.get<IServerAdapter>(DefaultServiceNames.ServerAdapter, true) || new HttpAdapter();
        this.adapter.init(container,
            new VulcainPipeline([
                new NormalizeDataMiddleware(),
                new MetricsMiddleware(),
                new AuthenticationMiddleware(),
                new HandlersMiddleware(container)
            ]));
    }

    public start(port: number) {
        if (this.enableHystrixStream) {
            this.adapter.registerNativeRoute("get", Conventions.instance.defaultHystrixPath, (request, response) => {
                response.setHeader('Content-Type', 'text/event-stream;charset=UTF-8');
                response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
                response.setHeader('Pragma', 'no-cache');
                System.log.info(null, () => "get hystrix.stream");

                let subscription = hystrixStream.toObservable().subscribe(
                    function onNext(sseData) {
                        response.write('data: ' + sseData + '\n\n');
                    },
                    function onError(error) {
                        System.log.info(null, () => "hystrixstream: error");
                    },
                    function onComplete() {
                        System.log.info(null, () => "end hystrix.stream");
                        return response.end();
                    }
                );
                request.on("close", () => {
                    System.log.info(null, () => "close hystrix.stream");
                    subscription.unsubscribe();
                });
            });
        }

        this.adapter.registerRoute('get', '/health', (req) => null);

        this.container.getCustomEndpoints().forEach(e => {
            this.adapter.registerRoute(e.verb, e.path, e.handler);
        });
    }
}