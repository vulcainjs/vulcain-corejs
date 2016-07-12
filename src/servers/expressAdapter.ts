// Entry point
import * as express from 'express';
import {IManager} from '../pipeline/common';
import {AbstractAdapter} from './abstractAdapter';
import {RequestContext} from './requestContext';
import {IContainer} from '../di/resolvers';
import {Authentication} from './expressAuthentication';
import {DefaultServiceNames} from '../application';
const bodyParser = require('body-parser');

export class ExpressAdapter extends AbstractAdapter {
    private app;

    constructor(domainName:string, container:IContainer) {
        super(domainName, container);
        this.app = express();
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(bodyParser.json());

        let auth = (this.container.get(DefaultServiceNames.Authentication) || container.resolve(Authentication)).init();
        let self = this;
        this.app.get('/:domain?/:action?', auth, async (req: express.Request, res: express.Response) => {
            this.executeRequest(this.executeQueryRequest, req, res);
        });

        this.app.post('/:domain?/:action?', auth, async (req: express.Request, res: express.Response) => {
            this.executeRequest(this.executeCommandRequest, req, res);
        });
    }

    private async executeRequest(handler: Function, req: express.Request, res: express.Response) {
        let command = req.body;
        command.domain = command.domain || req.params.domain;

        if (!command.action && !command.data && !command.domain) {
            command = { data: command };
        }
        command.action = command.action || req.params.action;
        command.data = command.data || {};

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
