import { System } from './../globals/system';

export interface ServiceDependency {
    service: string;
    version: string;
    discoveryAddress: string;
}

export interface ConfigurationInfo {
    key: string;
    schema: string;
}

export class VulcainManifest {
    dependencies: { [name: string]: Array<ServiceDependency> };
    configurations: { [name: string]: string };

    constructor() {
        this.dependencies = {};
        this.dependencies["services"] = [];
        this.configurations = {};
    }
}

/**
 * ServiceProxy attribute
 *
 */
export function ServiceProxy(service: string, version: string, discoveryAddress: string) {
    return (target: Function) => {
        System.manifest.dependencies["services"].push({service, version, discoveryAddress});
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