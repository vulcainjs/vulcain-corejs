import { System } from './../globals/system';

export interface ServiceDependencyInfo {
    service: string;
    version: string;
    discoveryAddress: string;
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
 * ServiceDependency attribute on Servicecommand
 *
 */
export function ServiceDependency(service: string, version: string, discoveryAddress: string) {
    return (target: Function) => {
        target["$dependency:service"] = { targetServiceName: service, targetServiceVersion: version };

        System.manifest.dependencies.services.push({service, version, discoveryAddress});
    };
}

export function HttpDependency(uri: string) {
    return (target: Function) => {
        target["$dependency:external"] = { uri };

        System.manifest.dependencies.externals.push({ uri });
    };
}

export function ConfigurationProperty(key: string, schema: string) {
    return (target: Function) => {
        if (!key)
            throw new Error("Invalid property key");

        let existingSchema = System.manifest.configurations[key];
        if(existingSchema) {
            if (existingSchema !== schema)
                throw new Error("Inconsistant schema for configuration property " + key);
            return;
        }
        System.manifest.configurations[key] = schema;
    };
}