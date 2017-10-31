import * as rx from 'rxjs';

export interface IConfigurationSource {
    get(name: string): any;
}

export interface ILocalConfigurationSource extends IConfigurationSource {
    readProperties(timeout?: number): Promise<DataSource>;
}

export interface IRemoteConfigurationSource extends IConfigurationSource {
    pollProperties(timeout?: number): Promise<DataSource>;
}


export interface ConfigurationItem {
    key: string;
    value: any;
    lastUpdate?: string;
    encrypted?: boolean;
    deleted?: boolean;
}

/// <summary>
/// This class represents a result from a poll of configuration source
/// </summary>
export class DataSource {

    public constructor(public values?: IterableIterator<ConfigurationItem>) {
    }
}

export interface IDynamicProperty<T> {
    name: string;
    value: T;
    propertyChanged: rx.Observable<IDynamicProperty<T>>;
    set(val: T): void;
}