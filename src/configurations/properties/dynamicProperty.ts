import {IDynamicProperty} from '../dynamicProperty';
import {DynamicProperties} from './dynamicProperties';
import * as rx from 'rx';

export class DynamicProperty<T> implements IDynamicProperty<T>
{
    private val:T;
    private  disposed = false;
    private _propertyChanged: rx.Subject<IDynamicProperty<T>>;

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        return this._propertyChanged;
    }

    constructor(private propertiesManager: DynamicProperties, public name: string, private defaultValue?:T) {
        this._propertyChanged = new rx.Subject<IDynamicProperty<T>>();
        DynamicProperties.registerPropertyAsDependency(name, defaultValue);
    }

    get value():T {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have call DynamicProperties.reset() ?");
        return this.val || this.defaultValue;
    }

    set(val:T)
    {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have call DynamicProperties.reset() ?");

        if( this.val !== val) {
            this.val = val;
            this.onPropertyChanged();
        }
    }

    private onPropertyChanged()
    {
        this._propertyChanged.onNext( this );
        this.propertiesManager.onPropertyChanged(this, "changed");
    }

    public reset() {
        this.val = undefined;
        this.onPropertyChanged();
    }

    public dispose()
    {
        this.disposed = true;
        this.onPropertyChanged();
        this._propertyChanged.dispose();
        this._propertyChanged = new rx.Subject<IDynamicProperty<T>>();
    }
}