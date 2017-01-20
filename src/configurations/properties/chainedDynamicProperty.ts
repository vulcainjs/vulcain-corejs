/// <summary>
/// Create a chained property composed with a dynamic property and fallback properties used if the main property is not defined.
/// A chained property works with fallback values. If the first is not defined, the value is founded in the first property values defined in the fallback list
/// and then the default value.
/// </summary>
/// <typeparam name="T">Property type</typeparam>
import { IDynamicProperty } from '../dynamicProperty';
import {DynamicProperties} from "./dynamicProperties";
import * as rx from 'rx';

export class ChainedDynamicProperty<T> implements IDynamicProperty<T>
{
    private _fallbackProperties:Array<string>;
    private  _activeProperty:IDynamicProperty<T>;
    private  _propertiesManager:DynamicProperties;
    private  _defaultValue;
    private disposed = false;
    private _reset;
    private _propertyChanged: rx.Subject<IDynamicProperty<T>>;

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        return this._propertyChanged;
    }

    get name()
    {
        return this._fallbackProperties[0];
    }

    constructor( manager:DynamicProperties, properties:Array<string>, defaultValue? )
    {
        if (properties.length < 2) throw new Error("You must provided at least 2 properties.");
        this._propertyChanged = new rx.Subject<IDynamicProperty<T>>();
        this._propertiesManager  = manager;
        this._defaultValue       = defaultValue;

        this._fallbackProperties = properties;

        // subscribe to changes
        this._reset = this.reset.bind(this);
        manager.propertyChanged.subscribe(this._reset);
        this.reset();
    }

    // One chained property has changed
    reset()
    {
        let old = this._activeProperty;
        let tmp;
        for( let propertyName of this._fallbackProperties )
        {
            tmp = this._propertiesManager.getProperty( propertyName );
            if( tmp )
            {
                break;
            }
        }

        this._activeProperty = tmp;
        if( old !== this._activeProperty)
        {
            this.onPropertyChanged();
        }
    }

    private onPropertyChanged()
    {
        this._propertyChanged.onNext( this );
        this._propertiesManager.onPropertyChanged(this, "changed");
    }

    /// <summary>
    /// Current value
    /// </summary>
    get value():T
    {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have call DynamicProperties.reset() ?");
        return this._activeProperty ? this._activeProperty.value : this._defaultValue;
    }

    /// <summary>
    /// Update default property value. This value can be overrided by a <see cref="IConfigurationSource"/>.
    /// Doesn't update source values.
    /// Assigning a value as precedence on all overriding properties
    /// Only the main property has precedence so others are ignored
    /// </summary>
    /// <param name="value">Property value</param>
    set( value:T )
    {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have call DynamicProperties.reset() ?");

        this._defaultValue = value;
        // Assigning a value as precedence on all overriding properties
        // Only the main property (the first) has precedence so ignore other one
        this._fallbackProperties = [this._fallbackProperties[0]];
        this.reset();
    }

    public dispose()
    {
        this.disposed = true;
        this.onPropertyChanged();
        this._propertyChanged.dispose();
        this._propertyChanged = new rx.Subject<IDynamicProperty<T>>();
    }
}