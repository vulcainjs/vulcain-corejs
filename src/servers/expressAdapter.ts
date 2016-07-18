// Entry point
import * as express from 'express';
import {IManager} from '../pipeline/common';
import {AbstractAdapter} from './abstractAdapter';
import {RequestContext} from './requestContext';
import {IContainer} from '../di/resolvers';
import {Authentication} from './expressAuthentication';
import {DefaultServiceNames} from '../application';
import {Conventions} from '../utils/conventions';

const bodyParser = require('body-parser');

export class ExpressAdapter extends AbstractAdapter {
    private app;

    constructor(domainName:string, container:IContainer) {
        super(domainName, container);
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        let auth = (this.container.get(DefaultServiceNames.Authentication, true) || container.resolve(Authentication)).init();
        let self = this;

        // Query can have only two options:
        //  - single query with an id
        //  - search query with a query expression in data
        this.app.get(Conventions.defaultUrlprefix + '/:domain/:id?', auth, async (req: express.Request, res: express.Response) => {

            let command = this.normalizeCommand(req);

            if (req.params.id !== undefined) {
                command.action = "get";
                command.data = { id: req.params.id };
            }
            else {
                command.action = command.action || "search";
                command.limit = command.limit || 100;
                command.page = command.page || 1;
            }
            this.executeRequest(this.executeQueryRequest, command, req, res);
        });

        // All actions by post
        this.app.post(Conventions.defaultUrlprefix + '/:domain/:action?', auth, async (req: express.Request, res: express.Response) => {
            this.executeRequest(this.executeCommandRequest, this.normalizeCommand(req), req, res);
        });

        this.app.get('/health', (req: express.Request, res: express.Response) => {
            res.status(200).end();
        });
    }

    private normalizeCommand(req: express.Request) {
        let command = req.body;
        command.domain = command.domain || req.params.domain;

        // Body contains only data -> create a new command object
        if (!command.action && !command.data && !command.domain) {
            command = { data: command };
        }
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
