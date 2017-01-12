import { CryptoHelper } from './crypto';
import { DynamicConfiguration } from './../dynamicConfiguration';
import { VulcainLogger } from './../log/vulcainLogger';
import * as moment from 'moment';
import * as fs from 'fs';
import { VulcainManifest } from './../dependencies/annotations';
import { Conventions } from './../../utils/conventions';
import { IDynamicProperty } from '../dynamicProperty';
import { MockManager } from '../../commands/mocks/mockManager';
import { DefaultServiceNames } from '../../di/annotations';

/**
 * Static class providing service helper methods
 *
 * @export
 * @class System
 */
export class System {

    private static _vulcainServer: string;
    private static _vulcainToken: string;
    private static _vulcainConfig;
    private static logger: VulcainLogger;
    private static _environment: string;
    private static _serviceName: string;
    private static _serviceVersion: string;
    private static _domainName: string;
    private static crypter: CryptoHelper;
    private static _environmentMode: "local" | "test" | "production";
    private static _manifest: VulcainManifest;
    private static _mocksManager: MockManager;

    static defaultDomainName: string;

    /**
     * Get the application manifest when the application runs in developement mode
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    public static get manifest() {
        if (!System._manifest)
            System._manifest = new VulcainManifest(System.serviceName, System.serviceVersion);
        return System._manifest;
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
     * Calculate a diff with a date from now in seconds using moment
     *
     * @static
     * @param {string} date in utc string format
     * @returns
     *
     * @memberOf System
     */
    static diffFromNow(date: string) {
        return moment.utc().diff(moment(date), "second");
    }

    /**
     * Acces to logger
     *
     * @static
     *
     * @memberOf System
     */
    static get log() {
        if (!System.logger)
            System.logger = new VulcainLogger();
        return System.logger;
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
        return process.env[Conventions.instance.ENV_VULCAIN_TENANT];
    }

    static get hasMocks() {
        return !!System._mocksManager;
    }

    static get mocks() {
        return System._mocksManager;
    }

    /**
     * Read configurations from .vulcain file
     * Set env type from environment variable then .vulcain config
     *
     * @private
     */
    private static readEnvironmentContext() {
        if (System._environmentMode) {
            return;
        }
        try {
            if (fs.existsSync(Conventions.instance.vulcainFileName)) {
                let data = fs.readFileSync(Conventions.instance.vulcainFileName, "utf8");
                if (data) {
                    System._vulcainConfig = JSON.parse(data);
                }
            }
            System._environmentMode = (process.env[Conventions.instance.ENV_VULCAIN_ENV_MODE]
                || (System._vulcainConfig && System._vulcainConfig.mode)
                || "production").toLowerCase(); // default

            if (System._environmentMode !== "production" && System._environmentMode !==  "test" && System._environmentMode !== "local") {
                throw new Error("Invalid environment mode. Should be 'production', 'test' or 'local'");
            }

            // TODO remove
            if (process.env["VULCAIN_TEST"] === "true") {
                System._environmentMode = "test";
            }
            if (System._environmentMode !== "local") {
                System._vulcainConfig = null; // reset all local config
            }
        }
        catch (e) {
            System.log.error(null, e, "VULCAIN MANIFEST : Loading error");
            System._environmentMode = "production";
        }

        System.log.info(null, `Running in ${System._environmentMode} mode`);
        if (System.isTestEnvironnment && System._vulcainConfig && System._vulcainConfig.mocks) {
            System._mocksManager = new MockManager(System._vulcainConfig.mocks);
        }
    }

    /**
     * Check if the service is running in local mode (on developper desktop)
     * by checking if a '.vulcain' file exists in the working directory
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    static get isDevelopment() {
        System.readEnvironmentContext();
        return System._environmentMode === "local";
    }

    /**
     * Check if the current service is running in a test environnement (VULCAIN_TEST=true)
     *
     * @static
     * @returns
     *
     * @memberOf System
     */
    static get isTestEnvironnment() {
        return System.isDevelopment || System._environmentMode === "test";
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
        if (System._vulcainConfig && System._vulcainConfig.alias) {
            let alias = System._vulcainConfig.alias[name];
            if (alias) {
                if (typeof alias === "string") {
                    return alias;
                }
                alias = alias[version];
                if (alias)
                    return alias;
            }
        }

        let propertyName = '$alias.' + name;
        if (version)
            propertyName = propertyName + "-" + version;

        let prop = DynamicConfiguration.getProperty<any>(propertyName);
        if (prop && prop.value) {
            if (!prop.value.serviceName && !prop.value.version) return prop.value;
            name = prop.value.serviceName || name;
            version = prop.value.version || version;
            return System.createContainerEndpoint(name, version);
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
        if (!System._environment) {
            let env = process.env[Conventions.instance.ENV_VULCAIN_ENV];
            if (env)
                System._environment = env;
            else {
                System.log.info(null, "Environment variable " + Conventions.instance.ENV_VULCAIN_ENV + " is not defined. Using 'dev' by default.");
                System._environment = "dev";
            }
        }
        return System._environment;
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
        if (!System._vulcainServer) {
            let env = DynamicConfiguration.getPropertyValue<string>("vulcainServer");
            System._vulcainServer = env; // for dev
        }
        return System._vulcainServer;
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
        if (System._vulcainToken === undefined) {
            System._vulcainToken = DynamicConfiguration.getPropertyValue<string>("vulcainToken");
        }
        return System._vulcainToken;
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
        if (!System._serviceName) {
            let env = process.env[Conventions.instance.ENV_SERVICE_NAME];
            if (env)
                System._serviceName = env;
            else
                return null;
        }
        return System._serviceName;
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
        if (!System._serviceVersion) {
            let env = process.env[Conventions.instance.ENV_SERVICE_VERSION];
            if (env)
                System._serviceVersion = env;
            else
                return null;
        }
        return System._serviceVersion;
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
        if (!System._domainName) {
            let env = process.env[Conventions.instance.ENV_VULCAIN_DOMAIN];
            if (env)
                System._domainName = env;
            else
                System._domainName = System.defaultDomainName;
        }
        return System._domainName;
    }

    private static get crypto() {
        if (!System.crypter) {
            System.crypter = new CryptoHelper();
        }
        return System.crypter;
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
        return System.crypto.encrypt(value);
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
        return System.crypto.decrypt(value);
    }

    /**
     * create a shared property
     * @param name
     * @param defaultValue
     * @returns {IDynamicProperty<T>}
     */
    public static createSharedConfigurationProperty<T>(name: string, defaultValue?: T): IDynamicProperty<T> {

        return DynamicConfiguration.asChainedProperty<T>(
            defaultValue,
            System.domainName && System.domainName + "." + name,
            name);
    }

    /**
     * create a new chained property for the current service. Properties chain is: service.version.name->service.name->team.namespace->name
     * @param name property name
     * @param defaultValue
     * @returns {IDynamicProperty<T>}
     */
    public static createServiceConfigurationProperty<T>(name: string, defaultValue?: T) {

        return DynamicConfiguration.asChainedProperty<T>(
            defaultValue,
            System.serviceName + "." + System.serviceVersion + "." + name,
            System.serviceName + "." + name,
            System.domainName + "." + name,
            name);
    }

    /**
     * create an url from segments
     * Segments of type string are concatened to provide the path
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
        const regex = /^([^:]*:\/\/)((\w*:)(\w*)@)?(.*)/g;
        const subst = `\$1\$3***@\$5`;

        // The substituted value will be contained in the result variable
        return url.replace(regex, subst);
    }
}
