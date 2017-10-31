import * as rx from 'rxjs';
import { IDynamicProperty } from '../abstractions';
import { ConfigurationManager } from '../configurationManager';
import { DynamicProperty } from './dynamicProperty';
import { Observable } from 'rxjs/Observable';

export class ChainedDynamicProperty<T>  implements IDynamicProperty<T> {
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<T>>;
    private _activeProperty: IDynamicProperty<any>;
    private val: T;
    private notifying: boolean;

    constructor(private manager: ConfigurationManager, public name: string, private _fallbackProperties: Array<string>, private defaultValue?) {
        if (this._fallbackProperties.indexOf(name) < 0)
            this._fallbackProperties.unshift(name);
        if (this._fallbackProperties.length < 1) throw new Error("You must provided at least 1 property.");

        this.reset();

        // subscribe to changes
        manager.propertyChanged.subscribe(this.reset.bind(this));
    }

    reset(dp?: IDynamicProperty<T>) {
        if (this.notifying)
            return;

        if (dp && this._fallbackProperties.indexOf(dp.name) < 0)
            return;

        this.notifying = true;
        this._activeProperty = null;
        const oldValue = this.value;

        // Find first property value in the chain
        for (let propertyName of this._fallbackProperties) {
            let dp = this.manager.getProperty(propertyName);
            if (dp && dp.value !== undefined) {
                this._activeProperty = dp;
                break;
            }
        }

        if (oldValue !== this.value)
            this.onPropertyChanged();

        this.notifying = false;
    }

    set(val: T) {
        if (this.val !== val) {
            this.val = val;
            this.onPropertyChanged();
        }
    }

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        if (!this._propertyChanged) {
            this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<T>>(1);
        }
        return <rx.Observable<IDynamicProperty<T>>>this._propertyChanged;
    }

    get value() {
        let v;
        if (this.val !== undefined)
            v = this.val;
        else if (this._activeProperty)
            v = this._activeProperty.value;
        return v || this.defaultValue;
    }

    protected onPropertyChanged() {
        if (!this.name || this.notifying)
            return;

        this.notifying = true;
        try {
            this._propertyChanged && this._propertyChanged.next(this);
            this.manager.onPropertyChanged(this);
        }
        finally {
            this.notifying = false;
        }
    }

    public dispose() {
        this.onPropertyChanged();
        //this._propertyChanged.dispose();
        this._propertyChanged = null;
    }
}
