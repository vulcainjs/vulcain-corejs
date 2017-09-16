import { IDynamicProperty } from "./abstractions";
import { ConfigurationManager } from "./configurationManager";
import { ConfigurationSourceBuilder } from "./configurationSourceBuilder";

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
* DynamicConfiguration.init().addRest("http....").startPollingAsync();
* let i:number = DynamicConfiguration.getProperty("prop1");
* let i2:number = DynamicConfiguration.getOrDefaultProperty("prop1", 1);
* </code>
*/
export class DynamicConfiguration {
/**
 * For test only - Do not use directly
 */
    static manager: ConfigurationManager;

    /**
     * subscribe on a property changed
     */
    public static onPropertyChanged<T>(handler: (e: IDynamicProperty<T>) => void, propertyName?: string) {
        if (propertyName) {
            let prop = DynamicConfiguration.manager.getProperty(propertyName);
            if (!prop) throw new Error("Property not found : " + propertyName);
            prop.propertyChanged.subscribe(handler);
        }
        else
            DynamicConfiguration.manager.propertyChanged.subscribe(handler);
    }

    /**
     * Create a new property
     */
    public static asProperty<T>(name: string, value: T): IDynamicProperty<T> {
        let p = DynamicConfiguration.manager.getProperty<T>(name);
        if (p) {
            throw new Error("Duplicate property " + name);
        }

        p = DynamicConfiguration.manager.createDynamicProperty(name, value);
        return p;
    }

    public static asChainedProperty<T>(name: string, defaultValue: T,  ...fallbackPropertyNames: Array<string>): IDynamicProperty<T> {
        let p = DynamicConfiguration.manager.getProperty<T>(name);
        if (p) {
            throw new Error("Duplicate property " + name);
        }

        p = DynamicConfiguration.manager.createChainedDynamicProperty(name, fallbackPropertyNames, defaultValue);
        return p;
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
        return p && <T>p.value;
    }

    /**
     * Get a dynamic property
     */
    static getProperty<T>(name: string): IDynamicProperty<T> {
        let prop = DynamicConfiguration.manager.getProperty<T>(name);
        return prop;
    }


    /// <summary>
    /// Initialise dynamic properties configuration. Can be call only once and before any call to DynamicProperties.instance.
    /// </summary>
    /// <param name="pollingIntervalInSeconds">Polling interval in seconds (default 60)</param>
    /// <param name="sourceTimeoutInMs">Max time allowed to a source to retrieve new values (Cancel the request but doesn't raise an error)</param>
    /// <returns>ConfigurationSourceBuilder</returns>
    public static init(pollingIntervalInSeconds?: number, sourceTimeoutInMs?: number) {
        if (DynamicConfiguration.manager)
            DynamicConfiguration.manager.reset();

        DynamicConfiguration.manager = new ConfigurationManager(pollingIntervalInSeconds || 60, sourceTimeoutInMs || 1000);
        return new ConfigurationSourceBuilder(DynamicConfiguration.manager);
    }
}