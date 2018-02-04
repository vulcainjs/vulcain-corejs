import { DefaultServiceNames, Inject, LifeTime } from '../di/annotations';
import { IContainer } from "../di/resolvers";
import { Domain } from '../schemas/domain';
import { RequestContext } from "../pipeline/requestContext";
import { ForbiddenRequestError } from "../pipeline/errors/applicationRequestError";
import { ServiceDescriptors } from "../pipeline/handlers/descriptions/serviceDescriptions";
import { ServiceDescription } from "../pipeline/handlers/descriptions/serviceDescription";
import { SwaggerServiceDescriptor } from './swagger/swaggerServiceDescriptions';
import { SwaggerApiDefinition } from './swagger/swaggerApiDefinition';
import { HttpResponse } from '../index';
import { Model, InputModel } from '../schemas/builder/annotations.model';
import { Property } from '../schemas/builder/annotations.property';
import { Query } from '../pipeline/handlers/query/annotations.query';
import { QueryHandler } from '../pipeline/handlers/query/annotations.queryHandler';

@InputModel(null, { system: true })
export class ServiceExplorerParameter {
    @Property({ description: "Format the description service. Only 'swagger' are available", type: "string" })
    format: string;
}

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton }, {system:true})
export class ServiceExplorer {

    constructor( @Inject(DefaultServiceNames.Domain) private domain: Domain,
        @Inject(DefaultServiceNames.Container) private container: IContainer) {
    }

    @Query({ outputSchema: "ServiceDescription", description: "Get all service handler description. You can get the response in swagger format with format=swagger", action: "_serviceDescription" })
    async getServiceDescriptions(model: ServiceExplorerParameter) {
        let ctx: RequestContext = (<any>this).context;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        let descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        let result: ServiceDescription = await descriptors.getDescriptions(false);
        result.alternateAddress = (<any>this).context.hostName;

        if (model.format === 'swagger') {
            let descriptors = this.container.get<SwaggerServiceDescriptor>(DefaultServiceNames.SwaggerServiceDescriptor);
            let swaggerResult: SwaggerApiDefinition = await descriptors.getDescriptions(result);
            let response = new HttpResponse();
            response.content = swaggerResult;
            return response;
        } else {
            return result;
        }
    }
}