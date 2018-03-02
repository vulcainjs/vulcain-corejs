import { CryptoHelper } from '../utils/crypto';
import { VulcainLogger } from './../log/vulcainLogger';
import * as moment from 'moment';
import * as fs from 'fs';
import { VulcainManifest } from './manifest';
import { Conventions } from '../utils/conventions';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer } from '../di/resolvers';
import { IStubManager, DummyStubManager } from "../stubs/istubManager";
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { IDynamicProperty } from '../configurations/abstractions';
import { Files } from '../utils/files';
import * as Path from 'path';
import { Settings } from './settings';

export enum ServiceStatus {
    Starting,
    Ready,
    Busy,
    Ending
}

/**
 * Static class providing service helper methods
 *
 * @export
 * @class Service
 */
export class Service {
    private static _settings: Settings;
    private static _vulcainServer: string;
    private static _vulcainToken: string;
    private static logger: VulcainLogger;
    private static _serviceName: string;
    private static _serviceVersion: string;
    private static _domainName: string;
    private static crypter: CryptoHelper;
    private static _manifest: VulcainManifest;
    private static _stubManager: IStubManager;
    static defaultDomainName: string;
    private static _serviceStatus: ServiceStatus = ServiceStatus.Starting;
    private static _statusTimer: NodeJS.Timer;

    public static get settings() {
        if (!Service._settings) {
            Service._settings = new Settings();
            Service.log.info(null, () => `Running in ${Service._settings.environment} environment.`);
        }
        return Service._settings;
    }

    static get serviceStatus() {
        return Service._serviceStatus;
    }

    private static setServiceStatusInternal(status: ServiceStatus) {
        if (status === ServiceStatus.Ready) {
            if(Service._serviceStatus !== ServiceStatus.Busy)
                fs.writeFileSync(Path.join(process.cwd(),"service.live"), "OK");
            fs.writeFileSync(Path.join(process.cwd(),"service.ready"), "OK");
        }
        else if (status === ServiceStatus.Busy) {
            fs.unlinkSync(Path.join(process.cwd(),"service.ready"));
        }
        else if(status !== ServiceStatus.Starting) {
            try {
                fs.unlinkSync(Path.join(process.cwd(),"service.live"));
            }
            catch (e) {
                // ignore
            }
            try {
                fs.unlinkSync(Path.join(process.cwd(),"service.ready"));
            }
            catch (e) {
                // ignore
            }
        }    
        Service._serviceStatus = status;
    }

    static setServiceStatus(status: ServiceStatus, timeoutInMs = 0) {
        if (Service._statusTimer) {
            clearTimeout(Service._statusTimer);
        }
        
        Service.setServiceStatusInternal(status);    

        if (timeoutInMs > 0) {
            Service._statusTimer = setTimeout(() => {
                Service.setServiceStatusInternal(ServiceStatus.Ending);
                Service._statusTimer = null;
            }, timeoutInMs);
        }
    }

    /**
     * Get the application manifest when the application runs in development mode
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    public static get manifest() {
        if (!Service._manifest)
            Service._manifest = new VulcainManifest(Service.serviceName, Service.serviceVersion);
        return Service._manifest;
    }

    /**
     * UTC date as string.
     *
     * @static
     * @returns
     *
     * @memberOf System
     */
    static nowAsString() {
        return moment.utc().format();
    }

    /**
     * Access to logger
     *
     * @static
     *
     * @memberOf System
     */
    static get log() {
        if (!Service.logger)
            Service.logger = new VulcainLogger();
        return Service.logger;
    }

    /**
     * Default tenant
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get defaultTenant() {
        return process.env[Conventions.instance.ENV_VULCAIN_TENANT] || 'vulcain';
    }

    static getStubManager(container: IContainer): IStubManager {
        if (!Service._stubManager) {
            if (Service.isTestEnvironment) {
                let manager = Service._stubManager = container.get<IStubManager>(DefaultServiceNames.StubManager);
                manager.initialize && manager.initialize(Service.settings.stubSessions, Service.settings.saveStubSessions.bind(Service.settings));
            }
            else {
                Service._stubManager = new DummyStubManager();
            }
        }
        return Service._stubManager;
    }

    /**
     * Check if the service is running in local mode (on developer desktop)
     * by checking if a '.vulcain' file exists in the working directory
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get isDevelopment() {
        return Service.settings.isDevelopment;
    }

    /**
     * Check if the current service is running in a test environnement (VULCAIN_TEST=true)
     *
     * @static
     * @returns
     *
     * @memberOf System
     */
    static get isTestEnvironment() {
        return Service.settings.isTestEnvironment;
    }

    /**
     * Resolve un alias (configuration key shared/$alternates/name-version)
     *
     * @param {string} name
     * @param {string} [version]
     * @returns null if no alias exists
     *
     * @memberOf System
     */
    static resolveAlias(name: string, version?: string): string {
        if(!name)
            return null;

        // Try to find an alternate uri
        let alias = Service.settings.getAlias(name, version);
        if (alias)
            return alias;

        let propertyName = name;
        if (version)
            propertyName = propertyName + "-" + version;

        let prop = DynamicConfiguration.getProperty<any>(propertyName);
        if (prop && prop.value) {
            if (!prop.value.serviceName && !prop.value.version) return prop.value;
            name = prop.value.serviceName || name;
            version = prop.value.version || version;
            return Service.createContainerEndpoint(name, version);
        }
        return null;
    }

    /**
     * Create container endpoint from service name and version
     *
     * @readonly
     * @static
     */
    static createContainerEndpoint(serviceName: string, version: string) {
        return (serviceName + version).replace(/[\.-]/g, '').toLowerCase() + ":8080";
    }

    /**
     * Get current environment
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get environment() {
        return Service.settings.environment;
    }

    /**
     * Get vulcain server used for getting configurations
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get vulcainServer() {
        if (Service._vulcainServer === undefined) {
            let env = DynamicConfiguration.getPropertyValue<string>("vulcainServer") ;
            Service._vulcainServer = env || null; // for dev
        }
        return Service._vulcainServer;
    }

    /**
     * Get token for getting properties (must have configurations:read scope)
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get vulcainToken() {
        if (Service._vulcainToken === undefined) {
            Service._vulcainToken = DynamicConfiguration.getPropertyValue<string>("vulcainToken") || null;
        }
        return Service._vulcainToken;
    }

    /**
     * Get service name
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get serviceName() {
        if (!Service._serviceName) {
            let env = process.env[Conventions.instance.ENV_SERVICE_NAME];
            if (env)
                Service._serviceName = env;
            else
                return null;
        }
        return Service._serviceName;
    }

    /**
     * Get service version
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get serviceVersion() {
        if (!Service._serviceVersion) {
            let env = process.env[Conventions.instance.ENV_SERVICE_VERSION];
            if (env)
                Service._serviceVersion = env;
            else
                return null;
        }
        return Service._serviceVersion;
    }

    static get fullServiceName() {
        return this.serviceName + "-" + this.serviceVersion;
    }

    /**
     * Get current domain name
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get domainName() {
        if (!Service._domainName) {
            let env = process.env[Conventions.instance.ENV_VULCAIN_DOMAIN];
            if (env)
                Service._domainName = env;
            else
                Service._domainName = Service.defaultDomainName;
        }
        return Service._domainName;
    }

    private static get crypto() {
        if (!Service.crypter) {
            Service.crypter = new CryptoHelper();
        }
        return Service.crypter;
    }

    /**
     * Encrypt a value
     *
     * @static
     * @param {any} value
     * @returns {string}
     *
     * @memberOf System
     */
    static encrypt(value): string {
        return Service.crypto.encrypt(value);
    }

    /**
     * Decrypt a value
     *
     * @static
     * @param {string} value
     * @returns
     *
     * @memberOf System
     */
    static decrypt(value: string) {
        return Service.crypto.decrypt(value);
    }

    static registerPropertyAsDependency(name: string, defaultValue) {
        let prefix = (Service.serviceName + "." + Service.serviceVersion);

        let p = Service.manifest.configurations[name];
        if (p && p !== "any")
            return;

        let schema = "any";
        if (typeof defaultValue === "number" || typeof defaultValue === "boolean" || defaultValue) {
            schema = typeof defaultValue;
        }
        Service.manifest.configurations[name] = schema;
    }

    /**
     * create an url from segments
     * Segments of type string are concatenated to provide the path
     * Segments of type object are appending in the query string
     * Null segments are ignored.
     * @protected
     * @param {string} base url
     * @param {(...Array<string|any>)} urlSegments
     * @returns an url
     */
    static createUrl(baseurl: string, ...urlSegments: Array<string | any>) {

        let hasQueryPoint = baseurl.includes("?");

        if (urlSegments) {
            if (!hasQueryPoint && baseurl[baseurl.length - 1] !== "/")
                baseurl += "/";

            let paths: Array<string> = urlSegments.filter((s: any) => typeof s === 'string');

            if (hasQueryPoint && paths.length >= 1) {
                throw new Error('You can\'t have a path on your url after a query string');
            } else {
                baseurl += paths.map((s: string) => encodeURIComponent(s)).join('/');
            }


            let query = urlSegments.filter((s: any) => s && typeof s !== 'string');
            if (query.length) {
                let sep = hasQueryPoint ? "&" : '?';
                query.forEach((obj: any) => {
                    for (let p in obj) {
                        if (!obj.hasOwnProperty(p)) {
                            continue;
                        }
                        if (obj[p]) {
                            baseurl = baseurl.concat(sep, p, '=', encodeURIComponent(obj[p]));
                            sep = '&';
                        }
                    }
                });
            }
            return baseurl;
        } else {
            return baseurl;
        }
    }

    static removePasswordFromUrl(url: string) {
        const regex = /(\/[^:]*:[^@]*@)/g;
        const subst = `****@`;

        // The substituted value will be contained in the result variable
        return url.replace(regex, subst);
    }
}
