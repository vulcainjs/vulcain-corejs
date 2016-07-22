// Entry point
import * as express from 'express';
import {IManager} from '../pipeline/common';
import {AbstractAdapter} from './abstractAdapter';
import {RequestContext} from './requestContext';
import {IContainer} from '../di/resolvers';
import {Authentication} from './expressAuthentication';
import {DefaultServiceNames} from '../application';
import {Conventions} from '../utils/conventions';
import {QueryData} from '../pipeline/query';
const bodyParser = require('body-parser');

export class ExpressAdapter extends AbstractAdapter {
    private app;

    constructor(domainName:string, container:IContainer) {
        super(domainName, container);
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        let auth = (this.container.get<Authentication>(DefaultServiceNames.Authentication, true) || container.resolve(Authentication)).init();
        let self = this;

        // Query can have only two options:
        //  - single query with an id
        //  - search query with a query expression in data
        this.app.get(Conventions.defaultUrlprefix + '/:domain/:id?', auth, async (req: express.Request, res: express.Response) => {

            let query: QueryData = <any>{ domain: this.domainName};

            if (req.params.id !== undefined) {
                query.action = "get";
                query.data = { id: req.params.id };
            }
            else {
                query.action = req.query.$action || "search";
                query.maxByPage = req.query.$maxByPage || 100;
                query.page = req.query.$page || 0;
                query.data = {};
                Object.keys(req.query).forEach(name => {
                    if (name && name[0] !== "$") {
                        query.data[name] = req.query[name];
                    }
                });
            }
            this.executeRequest(this.executeQueryRequest, query, req, res);
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
        command.data = command.data || {};
        return command;
    }

    private async executeRequest(handler: Function, command, req: express.Request, res: express.Response) {

        let ctx: RequestContext = new RequestContext(this.container);
        if(req.user && !req.user.__empty__)
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
