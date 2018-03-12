import { IContainer, NativeEndpoint } from '../di/resolvers';
import { VulcainPipeline, HttpRequest } from "./vulcainPipeline";
import { HttpResponse } from "./response";
import { Conventions } from '../utils/conventions';
import http = require('http');
import url = require('url');
import { ISerializer } from "./serializers/serializer";
import { DefaultSerializer } from "./serializers/defaultSerializer";
import { Service } from '../globals/system';

export interface IServerAdapter {
    init(container: IContainer, pipeline: VulcainPipeline);
    start(port: number, callback: (err) => void);  
    registerRoute(e: NativeEndpoint);
    getRoute(filter: (e:NativeEndpoint)=> boolean);
}

export abstract class ServerAdapter implements IServerAdapter {
    protected container: IContainer;
    protected vulcainPipe: VulcainPipeline;
    protected serializer: ISerializer;
    private routes = new Array<NativeEndpoint>();

    /**
     *
     */
    init(container: IContainer, vulcainPipeline: VulcainPipeline) {
        this.container = container;
        this.vulcainPipe = vulcainPipeline;
        this.serializer = new DefaultSerializer(container);
    }

    abstract start(port: number, callback: (err) => void);

    protected async processVulcainRequest(req: http.IncomingMessage, resp: http.ServerResponse, body, request?: HttpRequest) {
        request = request || { body: body, headers: req.headers, verb: req.method, url: url.parse(req.url, true), nativeRequest: req, nativeResponse: resp };
        let response: HttpResponse = null;
        try {
            request.body = this.serializer.deserialize(request);
            response = await this.vulcainPipe.process(this.container, request);
        }
        catch (e) {
            response = HttpResponse.createFromError(e);
        }
        if (!response)
            return; // Ignore response
        
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

            if (response.content) {
                if (!response.encoding || response.encoding === "utf8") {
                    const chunk = new Buffer(response.content, 'utf8');
                    resp.setHeader('Content-Type', (response.contentType || "application/json") + '; charset=utf-8');
                    resp.setHeader('Content-Length', String(chunk.length));
                    resp.end(chunk);
                }
                else {
                    resp.setHeader('Content-Type', response.contentType || "application/json");
                    resp.end(response.content, response.encoding);
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

    protected createRequest(req: http.IncomingMessage) {
        return  <HttpRequest> { body: null, headers: req.headers, verb: req.method, url: url.parse(req.url, true) };
    }

    registerRoute(e: NativeEndpoint) {
        this.routes.push(e);
    }

    getRoute(filter: (e:NativeEndpoint)=> boolean) {
        for (let e of this.routes) {
            if( filter(e))
                return e;    
        }
        return undefined;
    }
}

export class HttpAdapter extends ServerAdapter {
    private srv: http.Server;

    /**
     *
     */
    init(container: IContainer, vulcainPipeline: VulcainPipeline) {
        super.init(container, vulcainPipeline);
    }

    start(port: number, callback: (err) => void) {

        this.srv = http.createServer((req: http.IncomingMessage, resp: http.ServerResponse) => {
            let u = url.parse(req.url);
            let endpoint = this.getRoute(e => e.kind === "HTTP" && e.verb === req.method && u.pathname.startsWith(e.path));
            if (endpoint) {
                endpoint.handler(req, resp);
                return;
            }

            // Actions and query
            // POST/GET /api/...
            if ((req.method === "GET" || req.method === "POST")) {
                let buffer = [];
                req.on('data', (chunk) => {
                    buffer.push(chunk);
                }).on('end', async () => {
                    let body = req.method === "POST" && Buffer.concat(buffer).toString();
                    this.processVulcainRequest(req, resp, body);
                });
                return;
            }

            if (req.method === "OPTIONS") {
                resp.setHeader("Access-Control-Allow-Origin", "*");
                resp.setHeader("Access-Control-Allow-Methods", "GET,POST");
                resp.setHeader("Access-Control-Allow-Headers", "origin, content-type, accept");
                resp.setHeader("Access-Control-Allow-Credentials", "true");
                resp.setHeader('Content-Length', '0');
                resp.statusCode = 204;
            }
            else {
                resp.statusCode = 404;
            }
            resp.end();
        });

        this.srv.listen(port, callback);
    }
}
