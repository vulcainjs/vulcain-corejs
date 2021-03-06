import { IRemoteConfigurationSource, ConfigurationItem, DataSource } from "../abstractions";

export abstract class AbstractRemoteSource implements IRemoteConfigurationSource {
    private _values = new Map<string, ConfigurationItem>();

    abstract pollProperties(timeout?: number): Promise<DataSource>;

    get(name: string) {
        let v = this._values.get(name);
        return (v && v.value) || undefined;
    }

    protected mergeChanges(changes: Map<string, ConfigurationItem>) {
        changes && changes.forEach(item => {
            if (!item.deleted)
                this._values.set(item.key, item);
            else
                this._values.delete(item.key);
        });
    }
}

