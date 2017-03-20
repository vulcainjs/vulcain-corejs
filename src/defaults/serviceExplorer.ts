import { DefaultServiceNames, Inject, LifeTime } from '../di/annotations';
import { IContainer } from "../di/resolvers";
import { Domain } from '../schemas/schema';
import { ServiceDescriptors, ServiceDescription } from '../pipeline/serviceDescriptions';
import { Query } from '../pipeline/annotations';
import { QueryHandler } from '../pipeline/annotations.handlers';
import { ForbiddenRequestError } from '../errors/applicationRequestError';
import { RequestContext } from '../servers/requestContext';

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class ServiceExplorer {

    constructor( @Inject(DefaultServiceNames.Domain) private domain: Domain,
        @Inject(DefaultServiceNames.Container) private container: IContainer) {
    }

    @Query({ outputSchema: "ServiceDescription", description: "Get all service handler description", action: "_serviceDescription" })
    async getServiceDescriptions() {
        let ctx: RequestContext = (<any>this).requestContext;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        let descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        let result = await descriptors.getDescriptions();
        result.alternateAddress = (<any>this).requestContext.hostName;

        return result;
    }
}