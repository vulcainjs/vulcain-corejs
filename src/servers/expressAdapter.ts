// Entry point
import * as express from 'express';
import {IManager} from '../pipeline/common';
import {AbstractAdapter} from './abstractAdapter';
import {RequestContext, Pipeline, UserContext} from './requestContext';
import {IContainer} from '../di/resolvers';
import {Authentication} from './expressAuthentication';
import {DefaultServiceNames} from '../di/annotations';
import {Conventions} from '../utils/conventions';
import {QueryData} from '../pipeline/query';
const bodyParser = require('body-parser');
const cors = require('cors');

export class ExpressAdapter extends AbstractAdapter {
    public express: express.Express;

    constructor(domainName: string, container: IContainer) {
        super(domainName, container);

        this.express = express();
        this.express.use(cors());
        this.express.use(bodyParser.urlencoded({ extended: true }));
        this.express.use(bodyParser.json());

        let auth = (this.container.get<Authentication>(DefaultServiceNames.Authentication, true) || container.resolve(Authentication)).init();
        let self = this;

        this.express.get(Conventions.defaultUrlprefix + '/_schemas/:name?', (req: express.Request, res: express.Response) => {
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
        this.express.get(Conventions.defaultUrlprefix + '/:schema/id/:id', auth, async (req: express.Request, res: express.Response) => {
            let query: QueryData = <any>{ domain: this.domainName };
            query.action = "get";
            query.schema = req.params.schema;
            let requestArgs = this.populateFromQuery(req);
            if (requestArgs.count === 0)
                query.data = req.params.id;
            else {
                query.data = requestArgs.data;
                query.data.id = req.params.id;
            }
            this.executeRequest(this.executeQueryRequest, query, req, res);
        });

        this.express.get(Conventions.defaultUrlprefix + '/:schema/:action?', auth, async (req: express.Request, res: express.Response) => {

            try {
                let query: QueryData = <any>{ domain: this.domainName };
                query.action = req.params.action || req.query.$action || "search";
                query.maxByPage = (req.query.$maxByPage && parseInt(req.query.$maxByPage)) || 100;
                query.page = (req.query.$page && parseInt(req.query.$page)) || 0;
                query.schema = req.params.schema || req.query.$schema;
                query.data = this.populateFromQuery(req).data;
                this.executeRequest(this.executeQueryRequest, query, req, res);
            }
            catch (e) {
                res.status(400).send({ error: e.message || e.toString, status: "Error" });
            }
        });

        // All actions by post
        this.express.post(Conventions.defaultUrlprefix + '/:schema/:action?', auth, async (req: express.Request, res: express.Response) => {
            const cmd = this.normalizeCommand(req);
            this.executeRequest(this.executeCommandRequest, cmd, req, res);
        });

        this.express.post(Conventions.defaultUrlprefix + '/:schema?', auth, async (req: express.Request, res: express.Response) => {
            this.executeRequest(this.executeCommandRequest, this.normalizeCommand(req), req, res);
        });

        this.express.get('/health', (req: express.Request, res: express.Response) => {
            res.status(200).end();
        });
    }

    private populateFromQuery(req) {
        let data = {};
        let count = 0;;
        Object.keys(req.query).forEach(name => {
            switch (name) {
                case "$action":
                case "$schema":
                case "$page":
                case "$maxByPage":
                    break;
                case "$query":
                    data = JSON.parse(req.query[name]);
                    break;
                default:
                    count++;
                    data[name] = req.query[name];
            }
        });
        return { data, count };
    }

    private normalizeCommand(req: express.Request) {
        let command = req.body;

        // Body contains only data -> create a new command object
        if (!command.action && !command.data && !command.schema) {
            command = { data: command };
        }
        command.domain = this.domainName;
        command.action = command.action || req.params.action || req.query.$action;
        command.schema = command.schema || req.params.schema || req.query.$schema;
        command.data = command.data || {};
        return command;
    }

    private async executeRequest(handler: Function, command, req: express.Request, res: express.Response) {
        const begin = super.startRequest();

        try {
            let ctx: RequestContext = new RequestContext(this.container, Pipeline.Http);
            if (req.user && !req.user.__empty__)
                ctx.user = req.user;
            ctx.tenant = req.headers["X_VULCAIN_TENANT"] || process.env["VULCAIN_TENANT"] || RequestContext.TestTenant;
            ctx.requestHeaders = req.headers;

            let result = await handler.apply(this, [command, ctx]);
            if (ctx.responseHeaders) {
                for (const [k, v] of ctx.responseHeaders) {
                    res.setHeader(k, v);
                }
            }
            res.statusCode = ctx.responseCode || 200;
            res.send(result.value);
            this.endRequest(begin, command, res.statusCode);
        }
        catch (e) {
            res.status(500).send(e);
            this.endRequest(begin, command, 500);
        }
    }

    setStaticRoot(basePath: string) {
        console.log("Set wwwroot to " + basePath);
        if (!basePath) throw new Error("BasePath is required.");
        this.express.use(express.static(basePath));
    }

    start(port: number) {
        this.express.listen(port, (err) => {
            console.log('Listening on port ' + port);
        });
    }

    useMiddleware(verb: string, path: string, handler: Function) {
        this.express[verb](path, handler);
    }
}
