import { System } from './../globals/system';
import {DynamicPropertiesUpdater} from '../dynamicPropertiesUpdater'
import {ConfigurationManager} from '../configurationSources/configurationManager'
import {PropertiesFactory} from './propertiesFactory'
import {DynamicProperty} from './dynamicProperty'
import {IDynamicProperty} from '../dynamicProperty'
import {ConfigurationSourceBuilder} from "../configurationSources/configurationSourceBuilder";
import {ConfigurationSource} from "../configurationSources/configurationSource";
import * as rx from 'rx';

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
* let i:number = DynamicProperties.instance.getProperty("prop1");
* let i2:number = DynamicProperties.instance.getOrDefaultProperty("prop1", 1);
* </code>
*/
export class DynamicProperties implements DynamicPropertiesUpdater
{
    private _propertyChanged: rx.Subject<IDynamicProperty<any>>;

    /// <summary>
    /// Raises when a property has changed
    /// </summary>
    get propertyChanged(): rx.Observable<IDynamicProperty<any>> {
        return this._propertyChanged;
    }

    private static _instance:DynamicProperties;
    // Manage sources and polling
    private  _configurationManager:ConfigurationManager;
    private  _properties:Map<string, IDynamicProperty<any>> = new Map<string, IDynamicProperty<any>>();
    private _factory:PropertiesFactory;

    /**
     * for test only
     */
    static __forcePollingAsync() {
        return DynamicProperties.instance._configurationManager.polling();
    }

    /// <summary>
    /// Get the dynamic properties factory
    /// </summary>
    static get factory():PropertiesFactory
    {
        return DynamicProperties.instance._factory;
    }

    /// <summary>
    /// Get a singleton instance
    /// </summary>
    public static get instance()
    {
        if( !DynamicProperties._instance )
        {
            DynamicProperties.init();
        }
        return DynamicProperties._instance;
    }

    /// <summary>
    /// Initialise dynamic properties configuration. Can be call only once and before any call to DynamicProperties.instance.
    /// </summary>
    /// <param name="pollingIntervalInSeconds">Polling interval in seconds (default 60)</param>
    /// <param name="sourceTimeoutInMs">Max time allowed to a source to retrieve new values (Cancel the request but doesn't raise an error)</param>
    /// <returns>ConfigurationSourceBuilder</returns>
    public static init( pollingIntervalInSeconds?:number, sourceTimeoutInMs?:number )
    {
        if (DynamicProperties._instance)
            DynamicProperties._instance.reset();
        DynamicProperties._instance = new DynamicProperties( pollingIntervalInSeconds||60, sourceTimeoutInMs||1000 );
        return new ConfigurationSourceBuilder( DynamicProperties._instance._configurationManager );
    }

    addProperty( name:string, prop:IDynamicProperty<any> )
    {
        this._properties.set( name, prop );
    }

    /**
     * Private constructor
     * <param name="pollingIntervalInSeconds"></param>
     * <param name="sourceTimeoutInMs"></param>
     */
    constructor( pollingIntervalInSeconds?:number, sourceTimeoutInMs?:number )
    {
        this._propertyChanged = new rx.Subject<IDynamicProperty<any>>();
        this._factory = new PropertiesFactory( this );
        this.reset(pollingIntervalInSeconds, sourceTimeoutInMs);
    }

    /**
     /// Reset configuration and properties.
     /// All current properties will be invalid and all current sources will be lost.
     /// </summary>
     /// <param name="pollingIntervalInSeconds"></param>
     /// <param name="sourceTimeoutInMs"></param>
     */
    public reset( pollingIntervalInSeconds?:number, sourceTimeoutInMs?:number )
    {
        this._propertyChanged.dispose();
        this._propertyChanged = new rx.Subject<IDynamicProperty<any>>();

        var tmp  = this._properties;
        var tmp2 = this._configurationManager;

        this._properties           = new Map<string, DynamicProperty<any>>();
        this._configurationManager = new ConfigurationManager( this, pollingIntervalInSeconds||60, sourceTimeoutInMs||1000 );

        if( tmp )
        {
            for( let prop of tmp.values() )
            {
                if((<any>prop).dispose)
                    (<any>prop).dispose();
            }
            tmp.clear();
        }

        if( tmp2 )
            tmp2.dispose();
    }

    get pollingIntervalInSeconds()
    {
        return this._configurationManager != null ? this._configurationManager.pollingIntervalInSeconds : 0;
    }

    onPropertyChanged( property, action:string )
    {
        System.log.info(null, "CONFIG: Property changed " + property.name);
        this._propertyChanged.onNext(property );
    }

    // for tests only
    registerSourceAsync( source:ConfigurationSource )
    {
        return this._configurationManager.registerSourcesAsync( [source] );
    }

    /// <summary>
    /// Get a property or null if not exists
    /// </summary>
    /// <typeparam name="T">Property type</typeparam>
    /// <param name="name">Property name</param>
    /// <returns>A dynamic property instance or null if not exists.</returns>
    public getProperty( name:string )
    {
        let p = this._properties.get( name );
        return p;
    }

    public clear() {
        this._properties.clear();
    }

    /// <summary>
    /// Create or update a property with a value
    /// </summary>
    /// <param name="name">Property name</param>
    /// <param name="value">Default value</param>
    /// <returns>A dynamic property instance</returns>
    public createOrUpdateProperty( name:string, value )
    {
        let p = this._properties.get( name );
        if( !p )
        {
            p = this._factory.asProperty( value, name );
        }
        else
        {
            p.set(value);
        }
        return p;
    }

    /// <summary>
    /// Get a property or create a new one with a default value if not exists
    /// </summary>
    /// <typeparam name="T">Property type</typeparam>
    /// <param name="name">Property name</param>
    /// <param name="defaultValue">Default value</param>
    /// <returns>A dynamic property instance</returns>
    getOrCreateProperty( name:string, defaultValue: any )
    {
        let prop = this._properties.get( name );
        if( prop )
            return prop;

        return this._factory.asProperty( defaultValue, name );
    }


    Updater_getOrCreate( name:string, factory:()=>DynamicProperty<any> )
    {
        let prop = this._properties.get( name );
        if( !prop)
        {
            prop = factory();
            this._properties.set(name, prop);
        }
        return prop;
    }

    Updater_removeProperty( name:string )
    {
        let p = this._properties.get( name );
        p && p.reset();
    }

    public dispose()
    {
        for( let prop of this._properties.values() )
        {
            if((<any>prop).dispose)
                (<any>prop).dispose();
        }
        this._configurationManager.dispose();
        this._properties.clear();
        this._factory = null;
        this._propertyChanged.dispose();
    }
}