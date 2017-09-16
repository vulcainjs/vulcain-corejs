import * as rx from 'rxjs';
import { IDynamicProperty } from '../abstractions';
import { ConfigurationManager } from '../configurationManager';
import { DynamicProperty } from './dynamicProperty';

export class ChainedDynamicProperty<T>  extends DynamicProperty<T> {
    private _activeProperty: IDynamicProperty<any>;

    constructor( manager: ConfigurationManager, name: string, private _fallbackProperties: Array<string>, defaultValue?) {
        super(manager, name, defaultValue);
        if (_fallbackProperties.length < 1) throw new Error("You must provided at least 1 property.");

        this._fallbackProperties;

//        this.reset(this);

        // subscribe to changes
        manager.propertyChanged.subscribe(this.reset.bind(this));
    }

    reset(dp: IDynamicProperty<T>) {
        if (dp.name !== this.name && this._fallbackProperties.indexOf(dp.name) < 0)
            return;

        this._activeProperty = this;

        if (this.val === undefined || dp.name !== this.name || dp.value === undefined) {
            // Find first property value in the chain
            for (let propertyName of this._fallbackProperties) {
                let dp = this.manager.getProperty(propertyName);
                if (dp && dp.value !== undefined) {
                    this._activeProperty = dp;
                    if (this.value !== this._activeProperty.value) {
                        this.onPropertyChanged();
                    }
                    return;
                }
            }
        }

        this.set(dp.value);
    }

    get value() {
        if (this.removed)
            return undefined;
        let v;
        if (!this._activeProperty || this._activeProperty === this)
            v = this.val;
        else
            v = this._activeProperty.value;
        return v || this.defaultValue;
    }
}
