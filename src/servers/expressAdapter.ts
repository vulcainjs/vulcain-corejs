// Entry point
import * as express from 'express';
import {IManager} from '../pipeline/common';
import {AbstractAdapter} from './abstractAdapter';
import {RequestContext, Pipeline} from './requestContext';
import {IContainer} from '../di/resolvers';
import {Authentication} from './expressAuthentication';
import {DefaultServiceNames} from '../application';
import {Conventions} from '../utils/conventions';
import {QueryData} from '../pipeline/query';
const bodyParser = require('body-parser');

export class ExpressAdapter extends AbstractAdapter {
    private app;

    constructor(domainName: string, container: IContainer) {
        super(domainName, container);
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        let auth = (this.container.get<Authentication>(DefaultServiceNames.Authentication, true) || container.resolve(Authentication)).init();
        let self = this;

        this.app.get(Conventions.defaultUrlprefix + '/_schemas/:name?', (req: express.Request, res: express.Response) => {
            let domain: any = this.container.get("Domain");
            let name = req.params.name;
            if (name) {
                let schema = domain.getSchema(name, true);
                res.send(schema);
            }
            else
                res.send(domain.schemas)
        });

        // Query can have only two options:
        //  - single query with an id (and optional schema)
        //  - search query with a query expression in data
        this.app.get(Conventions.defaultUrlprefix + '/:domain/:schema/:id', auth, async (req: express.Request, res: express.Response) => {
            let query: QueryData = <any>{ domain: this.domainName };
            query.action = "get";
            let id = req.params.id;
            query.schema = req.params.schema || req.query.$schema;
            query.data = { id: id };
            this.executeRequest(this.executeQueryRequest, query, req, res);
        });

        this.app.get(Conventions.defaultUrlprefix + '/:domain/:id', auth, async (req: express.Request, res: express.Response) => {
            let query: QueryData = <any>{ domain: this.domainName };
            query.action = "get";
            let id = req.params.id;
            query.schema = req.query.$schema;
            query.data = { id: id };
            this.executeRequest(this.executeQueryRequest, query, req, res);
        });

        this.app.get(Conventions.defaultUrlprefix + '/:domain', auth, async (req: express.Request, res: express.Response) => {

            try {
                let query: QueryData = <any>{ domain: this.domainName };
                query.action = req.query.$action || "search";
                query.maxByPage = (req.query.$maxByPage && parseInt(req.query.$maxByPage)) || 100;
                query.page = (req.query.$page && parseInt(req.query.$page)) || 0;
                query.schema = req.query.$schema;
                query.data = {};
                Object.keys(req.query).forEach(name => {
                    if (name && name[0] !== "$") {
                        query.data[name] = req.query[name];
                    }
                });
                this.executeRequest(this.executeQueryRequest, query, req, res);
            }
            catch (e) {
                res.status(400).send({Error:e.message||e.toString, Status:"Error"});
            }
        });

        // All actions by post
        this.app.post(Conventions.defaultUrlprefix + '/:domain/:action?', auth, async (req: express.Request, res: express.Response) => {
            this.executeRequest(this.executeCommandRequest, this.normalizeCommand(req), req, res);
        });

        this.app.get('/health', (req: express.Request, res: express.Response) => {
            res.status(200).end();
        });

        this.app.get(Conventions.defaultUrlprefix + '/:domain/swagger', async (req: express.Request, res: express.Response) => {
        });
    }

    private normalizeCommand(req: express.Request) {
        let command = req.body;

        // Body contains only data -> create a new command object
        if (!command.action && !command.data && !command.domain) {
            command = { data: command };
        }
        command.domain = command.domain || req.params.domain;
        command.action = command.action || req.params.action;
        command.schema = command.schema || req.params.schema;
        command.data = command.data || {};
        return command;
    }

    private async executeRequest(handler: Function, command, req: express.Request, res: express.Response) {

        try {
            let ctx: RequestContext = new RequestContext(this.container, Pipeline.Http);
            if (req.user && !req.user.__empty__)
                ctx.user = req.user;

            let result = await handler.apply(this, [command, ctx]);
            if (result.headers) {
                for (const [k, v] of result.headers) {
                    res.setHeader(k, v);
                }
            }
            res.statusCode = result.code || 200;
            res.send(result.value);
        }
        catch (e) {
            res.status(500).send(e);
        }
    }

    setStaticRoot(basePath:string)
    {
        console.log("Set wwwroot to " + basePath);
        if(!basePath) throw new Error("BasePath is required.");
        this.app.use(express.static(basePath));
    }

    start(port:number)
    {
        this.app.listen(port, (err) => {
            console.log('Listening on port ' + port);
        });
    }

    useMiddleware(verb: string, path: string, handler: Function) {
        this.app[verb](path, handler);
    }
}
