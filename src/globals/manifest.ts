import { Service } from './../globals/system';
import * as fs from 'fs';
import * as Path from 'path';
import { Files } from "../utils/files";

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
    domain: string;

    constructor(public serviceName: string, public serviceVersion: string) {
        this.domain = Service.domainName;
        this.dependencies = {
            services: [],
            externals: [],
            databases: [],
            packages: Array.from(this.retrievePackage())
        };
        this.configurations = {};
    }

    registerExternal(uri: string) {
        let exists = this.dependencies.externals.find(ex => ex.uri === uri);
        if (!exists) {
            this.dependencies.externals.push({ uri });
        }
    }

    registerProvider(address: string, schema: string) {
        let exists = this.dependencies.databases.find(db => db.address === address && db.schema === schema);
        if (!exists) {
            this.dependencies.databases.push({ address, schema });
        }
    }

    registerService(targetServiceName: string, targetServiceVersion: string) {
        if (!targetServiceName)
            throw new Error("You must provide a service name");
        if (!targetServiceVersion || !targetServiceVersion.match(/[0-9]+\.[0-9]+/))
            throw new Error("Invalid version number. Must be on the form major.minor");

        let exists = this.dependencies.services.find(svc => svc.service === targetServiceName && svc.version === targetServiceVersion);
        if (!exists) {
            this.dependencies.services.push({ service: targetServiceName, version: targetServiceVersion });
        }
    }

    private *retrievePackage() {
        try {
            let packageFilePath = Path.join(process.cwd(), 'package.json');
            let json = fs.readFileSync(packageFilePath, "utf8");
            let pkg = JSON.parse(json);
            let dependencies = pkg.dependencies;

            let nodeModulesPath = Path.join(Path.dirname(packageFilePath), "node_modules");
            for (let packageName of Object.keys(dependencies)) {
                try {
                    json = fs.readFileSync(Path.join(nodeModulesPath, packageName, "package.json"), "utf8");
                    pkg = JSON.parse(json);
                }
                catch(e) {/*ignore*/}
                yield { name: packageName, version: (pkg && pkg.version) || "???" };
            }
        }
        catch (e) {
            //console.info("Can not read packages version. Skip it", e.message);
        }
    }
}

/**
 * Declare a vulcain service dependencies for the current service
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

        let exists = Service.manifest.dependencies.services.find(svc => svc.service === service && svc.version === version);
        if (!exists) {
            Service.manifest.dependencies.services.push({ service, version, discoveryAddress });
        }
    };
}

/**
 * Declare an external http call dependencies for the current service
 *
 * @export
 * @param {string} uri External uri
 * @returns
 */
export function HttpDependency(uri: string) {
    return (target: Function) => {
        target["$dependency:external"] = { uri };
        let exists = Service.manifest.dependencies.externals.find(ex => ex.uri === uri);
        if (!exists) {
            Service.manifest.dependencies.externals.push({ uri });
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
    return (target, propertyKey: string) => {
        if (!propertyName)
            throw new Error("Invalid property propertyName");

        if (!schema)
            throw new Error("Invalid property schema");

        schema = schema.toLowerCase();
        let existingSchema = Service.manifest.configurations[propertyName];
        if(existingSchema && existingSchema !== "any") {
            if (existingSchema !== schema)
                throw new Error(`Inconsistent schema (${schema} <> ${existingSchema}) for configuration property ${propertyName}`);
            return;
        }
        Service.manifest.configurations[propertyName] = schema;
    };
}