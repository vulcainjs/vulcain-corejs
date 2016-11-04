import { LifeTime } from '../di/annotations';
import { Query, QueryHandler } from '../pipeline/annotations';
import { System } from './../configurations/globals/system';
import { VulcainManifest } from './../configurations/dependencies/annotations';

@QueryHandler({ scope: "?", serviceLifeTime: LifeTime.Singleton })
export class DependencyExplorer {

    constructor() {
    }

    @Query({ outputSchema: VulcainManifest, description: "Get service dependencies", action: "_serviceDependencies" })
    getDependencies() {
        return System.manifest;
    }
}