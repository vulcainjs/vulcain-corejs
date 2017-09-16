import { ILocalConfigurationSource, ConfigurationItem, IRemoteConfigurationSource, DataSource } from "../abstractions";


export class MemoryConfigurationSource implements ILocalConfigurationSource {
    protected _values = new Map<string, ConfigurationItem>();
    readPropertiesAsync(timeout?: number): Promise<DataSource> {
        return Promise.resolve( new DataSource(this._values.values()));
    }

    /// <summary>
    /// Set a update a new property
    /// </summary>
    /// <param name="name">Property name</param>
    /// <param name="value">Property value</param>
    set(name: string, value: any) {
        this._values.set(name, { value, key: name });
    }

    get(name: string) {
        let v = this._values.get(name);
        return v && v.value;
    }
}

export class MockConfigurationSource extends MemoryConfigurationSource implements IRemoteConfigurationSource {
    pollPropertiesAsync(timeout?: number): Promise<DataSource> {
        return this.readPropertiesAsync();
    }
}