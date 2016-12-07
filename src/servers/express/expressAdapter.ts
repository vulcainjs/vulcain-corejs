import { Application } from '../../application';
import * as express from 'express';
import { AbstractAdapter, IHttpRequest } from './../abstractAdapter';
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
            self.createRequestContext(<IHttpRequest>(<any>req));
            return next();
        });

        this.express.use(cookieParser());
        this.express.use(cors());
        this.express.use(bodyParser.urlencoded({ extended: true }));
        this.express.use(bodyParser.json());
        let auth = this.container.get<any>(DefaultServiceNames.Authentication, true);
        this.auth = auth && auth.init(this.testUser);
    }

    private sendResponse(expressResponse: express.Response, response: HttpResponse) {
        if (!response) {
            expressResponse.end();
            return;
        }

        if (response.headers) {
            for (const [k, v] of response.headers) {
                expressResponse.setHeader(k, v);
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
    }

    protected initializeRequestContext(ctx: RequestContext, request: IHttpRequest) {
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
            let result = await this.executeQueryRequest(<IHttpRequest>req, ctx);
            this.sendResponse(res, result);
        });

        // All actions by post
        this.express.post(Conventions.instance.defaultUrlprefix + '/:schemaAction?', this.auth, async (req: any, res: express.Response) => {
            let ctx: RequestContext = req.requestContext;
            req.requestContext = null; // release for gc
            let result = await this.executeActionRequest(<IHttpRequest><any>req, ctx);
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
            let result = await this.executeActionRequest(<IHttpRequest><any>req, ctx, command);
            this.sendResponse(res, result);
        });
    }

    /**
     * Set static root for public web site
     *
     * @param {string} basePath
     *
     * @memberOf ExpressAdapter
     */
    setStaticRoot(basePath: string) {
        System.log.info(null, "Set wwwroot to " + basePath);
        if (!basePath) {
            throw new Error("BasePath is required.");
        }
        this.express.use(express.static(basePath));
/*        this.express.use('/assets', express.static(basePath + '/assets'));
        this.express.all('/*', function (req, res, next) {
            // Just send the index.html for other files to support HTML5Mode
            res.sendFile('index.html', { root: basePath });
        });*/
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