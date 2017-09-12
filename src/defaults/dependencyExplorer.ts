import { LifeTime } from '../di/annotations';
import { System } from './../globals/system';
import { VulcainManifest } from './../dependencies/annotations';
import { QueryHandler } from "../pipeline/handlers/annotations.handlers";
import { Query } from "../pipeline/handlers/annotations";
import { RequestContext } from "../pipeline/requestContext";
import { ForbiddenRequestError } from "../pipeline/errors/applicationRequestError";

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class DependencyExplorer {

    constructor() {
    }

    @Query({ outputSchema: "VulcainManifest", description: "Get service dependencies", action: "_serviceDependencies" })
    getDependencies() {
        let ctx: RequestContext = (<any>this).requestContext;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        return System.manifest;
    }
}