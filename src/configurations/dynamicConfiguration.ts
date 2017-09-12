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
    private static _configuration: ConfigurationManager;

    /**
     * subscribe on a property changed
     */
    public static onPropertyChanged<T>(handler: (e: IDynamicProperty<T>) => void, propertyName?: string) {
        if (propertyName) {
            let prop = DynamicConfiguration._configuration.getProperty(propertyName);
            if (!prop) throw new Error("Property not found : " + propertyName);
            prop.propertyChanged.subscribe(handler);
        }
        else
            DynamicConfiguration._configuration.propertyChanged.subscribe(handler);
    }

    /**
     * Create a new property
     */
    public static asProperty<T>(value: T, name?: string, dontCheck = false): IDynamicProperty<T> {
        if (!dontCheck && name && DynamicConfiguration._configuration.getProperty(name)) {
            throw new Error("Duplicate property name");
        }

        let p = DynamicConfiguration._configuration.createDynamicProperty(name, value);
        return p;
    }

    public static asChainedProperty<T>(defaultValue: T, name: string, ...fallbackPropertyNames: Array<string>): IDynamicProperty<T> {
        let properties = [name].concat(...fallbackPropertyNames).filter(n => !!n);
        let p = DynamicConfiguration._configuration.createChainedDynamicProperty(properties, defaultValue);
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
        let prop = DynamicConfiguration._configuration.getProperty<T>(name);
        return prop;
    }

    /**
     * Get or create a dynamic property
     * defaultValue can be a value or a factory
     */
    static getOrCreateProperty<T>(name: string, defaultValue?: T): IDynamicProperty<T> {
        let prop = this.getProperty<T>(name);
        if (prop)
            return prop;

        return DynamicConfiguration.asProperty<T>(defaultValue, name, true);
    }

    /// <summary>
    /// Initialise dynamic properties configuration. Can be call only once and before any call to DynamicProperties.instance.
    /// </summary>
    /// <param name="pollingIntervalInSeconds">Polling interval in seconds (default 60)</param>
    /// <param name="sourceTimeoutInMs">Max time allowed to a source to retrieve new values (Cancel the request but doesn't raise an error)</param>
    /// <returns>ConfigurationSourceBuilder</returns>
    public static init(pollingIntervalInSeconds?: number, sourceTimeoutInMs?: number) {
        if (DynamicConfiguration._configuration)
            DynamicConfiguration._configuration.reset();

        DynamicConfiguration._configuration = new ConfigurationManager(pollingIntervalInSeconds || 60, sourceTimeoutInMs || 1000);
        return new ConfigurationSourceBuilder(DynamicConfiguration._configuration);
    }
}