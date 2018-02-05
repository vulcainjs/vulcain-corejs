import { LifeTime } from '../di/annotations';
import { Service } from './../globals/system';
import { VulcainManifest } from '../globals/manifest';
import { RequestContext } from "../pipeline/requestContext";
import { ForbiddenRequestError } from "../pipeline/errors/applicationRequestError";
import { Query } from '../pipeline/handlers/query/annotations.query';
import { QueryHandler } from '../pipeline/handlers/query/annotations.queryHandler';

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton }, { system: true })
export class DependencyExplorer {

    constructor() {
    }

    @Query({ outputSchema: "VulcainManifest", description: "Get service dependencies", name: "_serviceDependencies" })
    getDependencies() {
        let ctx: RequestContext = (<any>this).context;
        if (ctx.publicPath)
            throw new ForbiddenRequestError();

        return Service.manifest;
    }
}