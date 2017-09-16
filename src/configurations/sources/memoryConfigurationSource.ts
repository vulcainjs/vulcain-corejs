import { ILocalConfigurationSource, ConfigurationItem, IRemoteConfigurationSource, DataSource } from "../abstractions";


export class MemoryConfigurationSource implements ILocalConfigurationSource {
    protected _values = new Map<string, any>();
    readPropertiesAsync(timeout?: number): Promise<void> {
        return Promise.resolve();
    }

    /// <summary>
    /// Set a update a new property
    /// </summary>
    /// <param name="name">Property name</param>
    /// <param name="value">Property value</param>
    set(name: string, value: any) {
        this._values.set(name, value);
    }

    get(name: string) {
        return this._values.get(name);
    }
}

export class MockConfigurationSource extends MemoryConfigurationSource implements IRemoteConfigurationSource {
    pollPropertiesAsync(timeout?: number): Promise<DataSource> {
        let list = [];
        for (let [key, value] of this._values) {
            list.push( {key, value} )
        }
        return Promise.resolve(new DataSource(list));
    }
}