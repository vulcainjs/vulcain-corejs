import * as rx from 'rxjs';
import { IDynamicProperty } from '../abstractions';
import { ConfigurationManager } from '../configurationManager';

export class ChainedDynamicProperty<T> implements IDynamicProperty<T> {
    private val: T;
    private removed: boolean;
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<T>>;
    private _fallbackProperties: string[];

    get name() {
        return this._fallbackProperties[0];
    }

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        if (!this._propertyChanged) {
            this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<T>>(1);
        }
        return <rx.Observable<IDynamicProperty<T>>>this._propertyChanged;
    }

    constructor(private manager: ConfigurationManager, properties: Array<string>, private defaultValue?) {
        if (properties.length < 1) throw new Error("You must provided at least 1 property.");

        this._fallbackProperties = properties;

        // subscribe to changes
        manager.propertyChanged.subscribe(this.reset.bind(this));
        this.reset(this);
    }

    reset(dp: IDynamicProperty<T>) {
        if (this._fallbackProperties.indexOf(dp.name) < 0)
            return;

        // Find first property value in the chain
        let tmp = this.defaultValue;
        for (let propertyName of this._fallbackProperties) {
            let dp = this.manager.getProperty(propertyName);
            if (!dp) {
                dp = this.manager.createDynamicProperty(propertyName);
            }
            else if (dp.value !== undefined) {
                tmp = dp.value;
                break;
            }
        }

        this.set(tmp);
    }

    set(val: T) {
        if (this.val !== val) {
            this.val = val;
            this.onPropertyChanged();
        }
    }

    get value() {
        return !this.removed ? this.val : undefined;
    }

    public dispose() {
        this.onPropertyChanged();
        this._propertyChanged = null;
    }

    private onPropertyChanged() {
        this._propertyChanged && this._propertyChanged.next(this);
        this.manager.onPropertyChanged(this);
    }
}
