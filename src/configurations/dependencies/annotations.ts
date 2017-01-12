import { System } from './../globals/system';
import * as fs from 'fs';
import * as Path from 'path';

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
        databases: Array<DatabaseDependencyInfo>,
        packages: { name: string, version: string }[]
    };
    configurations: { [name: string]: string };

    constructor(public serviceName: string, serviceVersion: string) {
        this.dependencies = {
            services: [],
            externals: [],
            databases: [],
            packages: Array.from(this.retrievePackage())
        };
        this.configurations = {};
    }

    private *retrievePackage() {
        try {
            let basePath = Path.dirname(require.main.filename);
            let json = fs.readFileSync(Path.join(basePath, "..", "package.json"), "utf8");
            let pkg = JSON.parse(json);
            let dependencies = pkg.dependencies;

            for (let packageName of Object.keys(dependencies)) {
                json = fs.readFileSync(Path.join(basePath, "..", 'node_modules', packageName, "package.json"), "utf8");
                pkg = JSON.parse(json);
                yield { name: packageName, version: pkg.version };
            }
        }
        catch (e) {
            System.log.error(null, e, "Can not read packages version. Skip it");
        }
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

        if (!schema)
            throw new Error("Invalid property schema");

        schema = schema.toLowerCase();
        let existingSchema = System.manifest.configurations[propertyName];
        if(existingSchema && existingSchema !== "any") {
            if (existingSchema !== schema)
                throw new Error(`Inconsistant schema (${schema} <> ${existingSchema}) for configuration property ${propertyName}`);
            return;
        }
        System.manifest.configurations[propertyName] = schema;
    };
}