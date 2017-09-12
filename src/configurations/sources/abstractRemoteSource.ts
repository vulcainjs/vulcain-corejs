import { IRemoteConfigurationSource, ConfigurationItem, DataSource } from "../abstractions";

export abstract class AbstractRemoteSource implements IRemoteConfigurationSource {
    private _values = new Map<string, ConfigurationItem>();

    abstract pollPropertiesAsync(timeout?: number): Promise<DataSource>;

    get(name: string) {
        let v = this._values.get(name);
        return v && v.value;
    }

    protected mergeChanges(changes: Map<string, ConfigurationItem>) {
        changes && changes.forEach(item => {
            if (!item.deleted)
                this._values.set(item.key, item.value);
        });
    }
}