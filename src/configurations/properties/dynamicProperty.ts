import { ConfigurationItem, IDynamicProperty } from "../abstractions";
import { ConfigurationManager } from "../configurationManager";
import * as rx from 'rxjs';
import { System } from "../../globals/system";

export interface IUpdatableProperty { // Internal interface
    updateValue(val: ConfigurationItem);
}

export class DynamicProperty<T> implements IDynamicProperty<T>, IUpdatableProperty {
    protected val: T;
    protected removed: boolean;
    protected notifying: boolean;
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<T>>;

    constructor(protected manager: ConfigurationManager, public name: string, protected defaultValue: T) {
        manager.properties.set(name, this);
        if(this.defaultValue !== undefined)
            this.onPropertyChanged();
    }

    get propertyChanged(): rx.Observable<IDynamicProperty<T>> {
        if (!this._propertyChanged) {
            this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<T>>(1);
        }
        return <rx.Observable<IDynamicProperty<T>>>this._propertyChanged;
    }

    get value() {
        return !this.removed ? (this.val||this.defaultValue) : undefined;
    }

    set(val: T) {
        if (this.val !== val) {
            this.val = val;
            this.onPropertyChanged();
        }
    }

    updateValue(item: ConfigurationItem) {
        if (item.deleted) {
            this.removed = true;
            System.log.info(null, () => `CONFIG: Removing property value for key ${this.name}`);
            this.onPropertyChanged();
            return;
        }

        if (this.val !== item.value) {
            this.val = item.encrypted ? System.decrypt(item.value) : item.value;
            let v = item.encrypted ? "********" : item.value;
            System.log.info(null, () => `CONFIG: Setting property value '${v}' for key ${this.name}`);
            this.onPropertyChanged();
            return;
        }
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
        this.removed = true;
    }
}
