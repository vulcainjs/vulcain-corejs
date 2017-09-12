import { ILocalConfigurationSource, ConfigurationItem } from "../abstractions";


export class MemoryConfigurationSource implements ILocalConfigurationSource {
    private _values = new Map<string, any>();
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