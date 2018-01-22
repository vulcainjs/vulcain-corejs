import * as rx from 'rxjs';
import { IDynamicProperty } from '../abstractions';
import { ConfigurationManager } from '../configurationManager';
import { DynamicProperty } from './dynamicProperty';
import { Observable } from 'rxjs/Observable';

export class ChainedDynamicProperty<T>  extends DynamicProperty<T> {
    private _activeProperty: IDynamicProperty<any>;

    constructor(manager: ConfigurationManager, name: string, private _fallbackProperties: Array<string>, defaultValue?) {
        super(manager, name, undefined);
        if (this._fallbackProperties.indexOf(name) < 0)
            this._fallbackProperties.unshift(name);
        if (this._fallbackProperties.length < 1) throw new Error("You must provided at least 1 property.");

        this.defaultValue = defaultValue;

        this.reset();

        manager.properties.set(name, this);

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
            if (propertyName === this.name) {
                if (this.val !== undefined) {
                    this._activeProperty = this;
                    break;
                }
            }
            else {
                let tmp = this.manager.getProperty(propertyName);
                if (tmp && tmp.value !== undefined) {
                    this._activeProperty = tmp;
                    break;
                }
            }
        }

        if (oldValue !== this.value)
            this.onPropertyChanged();

        this.notifying = false;
    }

    get value() {
        let v;
        if (this.removed)
            return undefined;
        if (this.val !== undefined)
            v = this.val;
        else if (this._activeProperty)
            v = this._activeProperty.value;
        return v || this.defaultValue;
    }
}
