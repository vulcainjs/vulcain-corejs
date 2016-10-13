import { DefaultServiceNames, Inject, LifeTime } from '../di/annotations';
import {Query, QueryHandler} from '../pipeline/annotations';
import { System, VulcainManifest } from 'vulcain-configurationsjs';

@QueryHandler({scope:"?", serviceLifeTime: LifeTime.Singleton})
export class DependencyExplorer {

    constructor( ) {
     }

    @Query({outputSchema: VulcainManifest, description: "Get service dependencies", action: "_serviceDependencies"})
    getDependencies() {
        return System.manifest;
    }
}