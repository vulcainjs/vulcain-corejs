import { LifeTime, DefaultServiceNames } from '../di/annotations';
import { System } from './../configurations/globals/system';
import { VulcainManifest } from './../configurations/dependencies/annotations';
import { QueryHandler } from "../pipeline/handlers/annotations.handlers";
import { Query } from "../pipeline/handlers/annotations";
import { RequestContext } from "../pipeline/requestContext";
import { ForbiddenRequestError, NotFoundError } from "../pipeline/errors/applicationRequestError";

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class SchemasDescriptor {

    constructor() {
    }

    @Query({ description: "Get schema description", action: "_schemas" })
    getDependencies() {
        let ctx: RequestContext = (<any>this).requestContext;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        let domain: any = ctx.container.get(DefaultServiceNames.Domain);
        let name = ctx.requestData.params;
        if (name) {
            let schema = domain.getSchema(name, true);
            if (!schema)
                throw new NotFoundError("Unknow schema");
            return schema.description
        }
        else {
            return domain.schemas;
        }
    }
}