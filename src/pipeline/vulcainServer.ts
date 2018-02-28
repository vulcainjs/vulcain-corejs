import { IContainer } from '../di/resolvers';
import { Conventions } from '../utils/conventions';
import { DefaultServiceNames } from '../di/annotations';
import { IMetrics } from '../instrumentations/metrics';
import { Service } from "../globals/system";
import { VulcainPipeline } from "./vulcainPipeline";
import { NormalizeDataMiddleware } from "./middlewares/normalizeDataMiddleware";
import { AuthenticationMiddleware } from "./middlewares/authenticationMiddleware";
import { HandlersMiddleware } from "./middlewares/handlersMiddleware";
import { IServerAdapter, HttpAdapter } from './serverAdapter';
import { GraphQLAdapter } from '../graphql/graphQLAdapter';
import { ServerSideEventMiddleware } from './middlewares/ServerSideEventMiddleware';

export class VulcainServer {
    private metrics: IMetrics;
    public adapter: IServerAdapter;

    constructor(protected domainName: string, protected container: IContainer) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);

        this.adapter = this.container.get<IServerAdapter>(DefaultServiceNames.ServerAdapter, true) || new HttpAdapter();
        this.adapter.init(container,
            new VulcainPipeline([
                new NormalizeDataMiddleware(),
                new AuthenticationMiddleware(),
                new ServerSideEventMiddleware(this.adapter),
                new HandlersMiddleware(container)
            ]));
        this.container.injectInstance(this.adapter, DefaultServiceNames.ServerAdapter); // Override current adapter
    }

    public start(port: number) {
        this.container.getCustomEndpoints().forEach(e => {
            this.adapter.registerRoute(e);
        });

        this.adapter.registerRoute({ kind: "HTTP", verb: "GET", path: "/health", handler: (req, res)=> {
            res.statusCode = 200;
            res.end();
        }
        });
        
        this.adapter.start(port, (err) => Service.log.info(null, () => 'Listening on port ' + port));
    }
}