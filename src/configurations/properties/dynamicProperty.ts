import {IDynamicProperty} from '../dynamicProperty';
import {DynamicProperties} from './dynamicProperties';
import * as rx from 'rxjs';

export class DynamicProperty<T> implements IDynamicProperty<T>
{
    private val:T;
    private  disposed = false;
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<T>>;

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        return this._propertyChanged;
    }

    constructor(private propertiesManager: DynamicProperties, public name: string, private defaultValue?:T) {
        this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<T>>(1);
    }

    get value():T {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have called DynamicProperties.reset() ?");
        return this.val || this.defaultValue;
    }

    set(val:T)
    {
        if( this.disposed ) throw new Error("Can not use a disposed property. Do you have called DynamicProperties.reset() ?");

        if( this.val !== val) {
            this.val = val;
            this.onPropertyChanged();
        }
    }

    private onPropertyChanged()
    {
        this._propertyChanged.next( this );
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
        //this._propertyChanged.dispose();
        this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<T>>(1);
    }
}