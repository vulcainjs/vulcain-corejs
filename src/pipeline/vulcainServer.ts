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

export class VulcainServer {
    private queryManager;
    private metrics: IMetrics;
    private pipe: VulcainPipeline;
    private router: Router;

    constructor(protected domainName: string, protected container: IContainer, private enableHystrixStream=false) {
        this.router = Router();

        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);

        this.pipe = new VulcainPipeline([
            new NormalizeDataMiddleware(),
            new MetricsMiddleware(),
            new AuthenticationMiddleware(),
            new HandlersMiddleware(container)
        ]);
    }

    private init() {
        if (this.enableHystrixStream) {
            this.router.get(Conventions.instance.defaultHystrixPath, (request, response: http.ServerResponse) => {
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

                return subscription;
            });
        }

        this.router.get('/health', (req, res) => {
            res.statusCode = 200;
            res.end();
        });
    }

    public start(port: number) {
        this.init();

        this.container.getCustomEndpoints().forEach(e => {
            this.router[e.verb](e.path, (req: http.IncomingMessage, res: http.ServerResponse) => {
                let request: HttpRequest = { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) }
                let result = e.handler(request);
                this.sendResponse(res, result);
            });
        });

        let srv = http.createServer((req, resp) => {
            let request: HttpRequest = { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) }
            // Actions and query
            // POST/GET /api/...
            if (req.url.startsWith(Conventions.instance.defaultUrlprefix) && (req.method === "GET" || req.method === "POST")) {
                this.processVulcainRequest(request, req, resp);
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

        srv.listen(port, (err) => {
            console.log("Server started...");
        });
    }

    processVulcainRequest(request: HttpRequest, req: http.IncomingMessage, resp: http.ServerResponse) {
        try {

            let body = [];
            req.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', async () => {
                request.body = req.method === "POST" && Buffer.concat(body).toString();
                let result = await this.pipe.process(this.container, request);
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
            if( System.isTestEnvironnment)
                resp.setHeader('Access-Control-Allow-Origin', '*'); // CORS

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
}