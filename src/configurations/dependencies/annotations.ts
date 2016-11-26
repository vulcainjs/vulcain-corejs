import { System } from './../globals/system';

export interface ServiceDependencyInfo {
    service: string;
    version: string;
    discoveryAddress?: string;
}

export interface ConfigurationInfo {
    key: string;
    schema: string;
}

export interface DatabaseDependencyInfo {
    address: string;
    schema: string;
}

export interface ExternalDependencyInfo {
    uri: string;
}

/**
 * Contains all service dependencies
 *
 * @export
 * @class VulcainManifest
 */
export class VulcainManifest {
    dependencies: {
        services: Array<ServiceDependencyInfo>,
        externals: Array<ExternalDependencyInfo>,
        databases: Array<DatabaseDependencyInfo>
    };
    configurations: { [name: string]: string };

    constructor() {
        this.dependencies = {
            services: [],
            externals: [],
            databases: []
        };
        this.configurations = {};
    }
}

/**
 * Declare a vulcain service dependencie for the current service
 *
 * @export
 * @param {string} service Name of the called service
 * @param {string} version Version of the called service
 * @param {string} discoveryAddress Discovery address of the called service (ex:http://..:30000/api/_servicedesctipyion)
 * @returns
 */
export function ServiceDependency(service: string, version: string, discoveryAddress: string) {
    return (target: Function) => {
        target["$dependency:service"] = { targetServiceName: service, targetServiceVersion: version };

        let exists = System.manifest.dependencies.services.find(svc => svc.service === service && svc.version === version);
        if (!exists) {
            System.manifest.dependencies.services.push({ service, version, discoveryAddress });
        }
    };
}

/**
 * Declare an external http call dependencie for the current service
 *
 * @export
 * @param {string} uri External uri
 * @returns
 */
export function HttpDependency(uri: string) {
    return (target: Function) => {
        target["$dependency:external"] = { uri };
        let exists = System.manifest.dependencies.externals.find(ex => ex.uri === uri);
        if (!exists) {
            System.manifest.dependencies.externals.push({ uri });
        }
    };
}

/**
 * Declare a dynamic property configuration for the current service.
 *
 * @export
 * @param {string} propertyName Property name
 * @param {string} schema Property schema (can be a model or a native js type)
 * @returns
 */
export function ConfigurationProperty(propertyName: string, schema: string) {
    return (target: Function) => {
        if (!propertyName)
            throw new Error("Invalid property propertyName");

        let existingSchema = System.manifest.configurations[propertyName];
        if(existingSchema) {
            if (existingSchema !== schema)
                throw new Error("Inconsistant schema for configuration property " + propertyName);
            return;
        }
        System.manifest.configurations[propertyName] = schema;
    };
}