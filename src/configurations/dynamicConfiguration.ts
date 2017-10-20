import { IDynamicProperty } from "./abstractions";
import { ConfigurationManager } from "./configurationManager";
import { ConfigurationSourceBuilder } from "./configurationSourceBuilder";
import { System } from "../globals/system";
import * as rx from 'rxjs';

/**
 *
* Provides dynamic properties updated when config change.
* Accessing a dynamic property is very fast. The last value is cached and updated on the fly
* from a <b>ConfigurationSource</b> at fixed interval.
* Updates are made using polling requests on a list of sources.
* <p>
* Dynamic properties are read only. You can set a value but it will be valid only as a default value.
* </p>
* <code>
* DynamicConfiguration.init().addRest("http....").startPolling();
* let i:number = DynamicConfiguration.getProperty("prop1");
* let i2:number = DynamicConfiguration.getOrDefaultProperty("prop1", 1);
* </code>
*/
export class DynamicConfiguration {
    /**
     * For test only - Do not use directly
     */
    private static manager: ConfigurationManager = new ConfigurationManager();
    private static _builder: ConfigurationSourceBuilder;

    /**
     * subscribe for a global property changed
     */
    public static get propertyChanged(): rx.Observable<IDynamicProperty<any>> {
        return DynamicConfiguration.manager.propertyChanged;
    }

    /**
     * Get a property
     */
    public static getProperty<T>(name: string, value?: T): IDynamicProperty<T> {
        let p = DynamicConfiguration.manager.getProperty<T>(name);
        if (!p) {
            p = DynamicConfiguration.manager.createDynamicProperty(name, value);
        }
        return p;
    }

    public static getChainedProperty<T>(name: string, defaultValue: T, ...fallbackPropertyNames: Array<string>): IDynamicProperty<T> {
        let p = DynamicConfiguration.manager.getProperty<T>(name);
        if (!p) {
            p = DynamicConfiguration.manager.createChainedDynamicProperty(name, fallbackPropertyNames, defaultValue);
        }
        return p;
    }

    /**
     * get a chained property for the current service.
     * Properties chain is: service.version.name->service.name->domain.name->name
     * @param name property name
     * @param defaultValue
     * @returns {IDynamicProperty<T>}
     */
    public static getChainedConfigurationProperty<T>(name: string, defaultValue?: T, commandName?: string) {
        let p = DynamicConfiguration.manager.getProperty<T>(name);
        if (p)
            return p;
        System.registerPropertyAsDependency(name, defaultValue);

        let fullName = commandName ? commandName + "." + name : name;
        let chain = [
            System.serviceName + "." + System.serviceVersion + "." + fullName,
            System.serviceName + "." + fullName,
        ];

        if (commandName) {
            chain.push(fullName);
        }

        if (System.domainName)
            chain.push(System.domainName + "." + name);

        chain.push(name);

        return DynamicConfiguration.getChainedProperty<T>(
            name,
            defaultValue,
            ...chain);
    }

    /**
     * Get a property value by name
     *
     * @static
     * @template T
     * @param {string} name
     * @returns
     *
     * @memberOf DynamicConfiguration
     */
    static getPropertyValue<T>(name: string) {
        let p = this.getProperty<T>(name);
        return p.value;
    }

    /// <summary>
    /// Initialise dynamic properties configuration. Can be call only once and before any call to DynamicProperties.instance.
    /// </summary>
    /// <param name="pollingIntervalInSeconds">Polling interval in seconds (default 60)</param>
    /// <param name="sourceTimeoutInMs">Max time allowed to a source to retrieve new values (Cancel the request but doesn't raise an error)</param>
    /// <returns>ConfigurationSourceBuilder</returns>
    public static getBuilder(pollingIntervalInSeconds?: number, sourceTimeoutInMs?: number) {
        if (pollingIntervalInSeconds)
            DynamicConfiguration.manager.pollingIntervalInSeconds = pollingIntervalInSeconds;
        if (sourceTimeoutInMs)
            DynamicConfiguration.manager.sourceTimeoutInMs = sourceTimeoutInMs;

        if (!DynamicConfiguration._builder) {
            DynamicConfiguration._builder = new ConfigurationSourceBuilder(DynamicConfiguration.manager);
        }
        return DynamicConfiguration._builder;
    }

    /**
     *
     * @param pollingIntervalInSeconds For test only
     */
    public static reset(pollingIntervalInSeconds?: number) {
        DynamicConfiguration.manager = new ConfigurationManager();
        if (pollingIntervalInSeconds)
            DynamicConfiguration.manager.pollingIntervalInSeconds = pollingIntervalInSeconds;
        return DynamicConfiguration.manager;
    }
}