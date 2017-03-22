import { Application } from '../../application';
import * as express from 'express';
import { AbstractAdapter, IHttpAdapterRequest } from './../abstractAdapter';
import { RequestContext, Pipeline } from './../requestContext';
import { IContainer } from '../../di/resolvers';
import { DefaultServiceNames } from '../../di/annotations';
import { Conventions } from '../../utils/conventions';
import { HttpResponse } from './../../pipeline/response';
import { System } from './../../configurations/globals/system';
import { ITenantPolicy } from './../policy/defaultTenantPolicy';
import { IHttpResponse } from '../../commands/command/types';
import { ExpressAuthentication } from './expressAuthentication';
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const cors = require("cors");

export class ExpressAdapter extends AbstractAdapter {
    public express: express.Express;
    private auth;

    constructor(domainName: string, container: IContainer, private app: Application) {
        super(domainName, container);

        const self = this;
        this.express = express();

        this.express.use(function (req, res, next) {
            const regex = /^\/api[\/?#]/;
            if (regex.test(req.originalUrl) || req.originalUrl === "/api") {
                // Initialize request context
                self.startRequest(<IHttpAdapterRequest>(<any>req));
            }
            return next();
        });

        this.express.use(cookieParser());
        this.express.use(cors());
        this.express.use(bodyParser.urlencoded({ extended: true }));
        this.express.use(bodyParser.json());
        let auth = this.container.get<any>(DefaultServiceNames.Authentication, true);
        this.auth = auth && auth.init();
    }

    private sendResponse(expressResponse: express.Response, response: HttpResponse) {
        if (!response) {
            expressResponse.end();
            return;
        }

        try {
            if (response.headers) {
                for (const k of Object.keys(response.headers)) {
                    expressResponse.setHeader(k, response.headers[k]);
                }
            }

            expressResponse.statusCode = response.statusCode || 200;
            if (response.contentType && response.contentType !== HttpResponse.VulcainContentType) {
                expressResponse.contentType(response.contentType);
            }
            if (response.content) {
                if (response.encoding) {
                    expressResponse.end(response.content, response.encoding);
                }
                else {
                    expressResponse.send(response.content);
                }
            }
            else {
                expressResponse.end();
            }
        }
        catch (e) {
            try {
                expressResponse.end();
            }
            catch (e) { }
        }
    }

    protected initializeRequestContext(ctx: RequestContext, request: IHttpAdapterRequest) {
        ctx.headers = request.headers;
        ctx.hostName = (<express.Request><any>request).get('Host');
        // Set requestcontext for authentication middlewares
        (<any>request).requestContext = ctx;
    }

    initialize() {

        this.express.get('/health', (req: express.Request, res: express.Response) => {
            res.status(200).end();
        });

        this.express.get(Conventions.instance.defaultUrlprefix + '/_schemas/:name?', (req: express.Request, res: express.Response) => {
            let domain: any = this.container.get(DefaultServiceNames.Domain);
            let name = req.params.name;
            if (name) {
                let schema = domain.getSchema(name, true);
                res.send(schema);
            }
            else {
                res.send(domain.schemas);
            }
        });

        this.express.get(Conventions.instance.defaultUrlprefix + '/:schemaAction?/:id?', this.auth, async (req: any, res: express.Response) => {
            let ctx: RequestContext = req.requestContext;
            req.requestContext = null; // release for gc
            let result = await this.executeQueryRequest(<IHttpAdapterRequest>req, ctx);
            this.sendResponse(res, result);
        });

        // All actions by post
        this.express.post(Conventions.instance.defaultUrlprefix + '/:schemaAction?', this.auth, async (req: any, res: express.Response) => {
            let ctx: RequestContext = req.requestContext;
            req.requestContext = null; // release for gc
            let result = await this.executeActionRequest(<IHttpAdapterRequest><any>req, ctx);
            this.sendResponse(res, result);
        });
    }

    addActionCustomRoute(verb: string, path: string, callback: (req) => { action: string, schema: string, params: any }) {
        this.express[verb](path, this.auth, async (req: any, res: express.Response) => {
            let ctx: RequestContext = req.requestContext;
            req.requestContext = null; // release for gc

            let command: any = callback(req);
            if (!command || !command.action) {
                throw new Error("Invalid custom command configuration");
            }
            command.domain = this.domainName;
            let result = await this.executeActionRequest(<IHttpAdapterRequest><any>req, ctx, command);
            this.sendResponse(res, result);
        });
    }

    /**
     * Set static root for public web site
     *
     * @param {string} urlPath - url path
     * @param {string} folderPath - folder static path
     *
     * @memberOf ExpressAdapter
     */
    setStaticRoot(urlPath: string, folderPath: string, options?) {
        System.log.info(null, `Set static path ${urlPath} to ${folderPath}`);
        if (!urlPath) {
            throw new Error("urlPath is required.");
        }
        if (!folderPath) {
            throw new Error("folderPath is required.");
        }
        this.express.use(urlPath, express.static(folderPath, options));
    }

    start(port: number) {
        let listener = this.express.listen(port, (err) => {
            System.log.info(null, 'Listening on port ' + port);
        });

        this.app.onServerStarted(listener, this);
    }

    useMiddleware(verb: string, path: string, handler: Function) {
        this.express[verb](path, handler);
    }
}
