import { IContainer } from '../di/resolvers';
import { VulcainPipeline, HttpRequest } from "./vulcainPipeline";
import { HttpResponse } from "./response";
import { Conventions } from '../utils/conventions';
import http = require('http');
import url = require('url');
import Router = require('router');
import { DefaultServiceNames } from '../index';
import { ISerializer } from "./serializers/serializer";
import { DefaultSerializer } from "./serializers/defaultSerializer";

export interface IServerAdapter {
    init(container: IContainer, pipeline: VulcainPipeline);
    startAsync(port: number, callback: (err) => void);
    registerRoute(verb: string, path: string, handler: (request: HttpRequest) => HttpResponse);
    registerNativeRoute(verb: string, path: string, handler: (request: http.IncomingMessage, res: http.ServerResponse) => void);
}

export abstract class ServerAdapter implements IServerAdapter {
    protected container: IContainer;
    protected vulcainPipe: VulcainPipeline;
    protected serializer: ISerializer;
    /**
     *
     */
    init(container: IContainer, vulcainPipeline: VulcainPipeline) {
        this.container = container;
        this.vulcainPipe = vulcainPipeline;
        this.serializer = new DefaultSerializer(container);
    }

    abstract startAsync(port: number, callback: (err) => void);

    protected async processVulcainRequest(req: http.IncomingMessage, resp: http.ServerResponse, body, request?: HttpRequest) {
        request = request || { body: body, headers: req.headers, verb: req.method, url: url.parse(req.url, true) };
        let response: HttpResponse = null;
        try {
            request.body = this.serializer.deserialize(request);
            response = await this.vulcainPipe.process(this.container, request);
        }
        catch (e) {
            response = HttpResponse.createFromError(e);
        }
        response = this.serializer.serialize(request, response);
        this.sendResponse(resp, response);
    }

    protected sendResponse(resp: http.ServerResponse, response: HttpResponse) {
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
                resp.end(response.content, response.encoding || "utf8");
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

    protected createRequest(req: http.IncomingMessage) {
        return  <HttpRequest> { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) };
    }

    abstract registerRoute(verb: string, path: string, handler: (request: HttpRequest) => HttpResponse);

    abstract registerNativeRoute(verb: string, path: string, handler: (request: http.IncomingMessage, res: http.ServerResponse) => void);
}
export class HttpAdapter extends ServerAdapter {
    private srv: http.Server;
    private router: Router;
    /**
     *
     */
    init(container: IContainer, vulcainPipeline: VulcainPipeline) {
        super.init(container, vulcainPipeline);
        this.router = Router();
    }

    startAsync(port: number, callback: (err) => void) {

        this.srv = http.createServer((req, resp) => {
            // Actions and query
            // POST/GET /api/...
            if (req.url.startsWith(Conventions.instance.defaultUrlprefix) && (req.method === "GET" || req.method === "POST")) {
                let buffer = [];
                req.on('data', (chunk) => {
                    buffer.push(chunk);
                }).on('end', async () => {
                    let body = req.method === "POST" && Buffer.concat(buffer).toString();
                    this.processVulcainRequest(req, resp, body);
                });
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

        this.srv.listen(port, callback);
    }

    registerRoute(verb: string, path: string, handler: (request: HttpRequest) => HttpResponse) {
        this.router[verb](path, (req: http.IncomingMessage, res: http.ServerResponse) => {
            let result = handler(this.createRequest(req));
            this.sendResponse(res, result);
        });
    }

    registerNativeRoute(verb: string, path: string, handler: (request: http.IncomingMessage, res: http.ServerResponse) => void) {
        this.router[verb](path, handler);
    }
}
