export interface ConfigurationItem {
    key: string;
    value: any;
    lastUpdate?: string;
    encrypted?: boolean;
    deleted?: boolean;
}

export enum ConfigurationDataType {
    KeyValue,
    Json
}

/// <summary>
/// This class represents a result from a poll of configuration source
/// </summary>
export class PollResult
{
    /// <summary>
    /// Values to update
    /// </summary>
    public values: Map<string,ConfigurationItem>;

    public source: IRemoteConfigurationSource;

    public constructor(source:IRemoteConfigurationSource, values?:Map<string,ConfigurationItem>)
    {
        this.source = source;
        this.values = values;
    }
}

export interface IConfigurationSource { }

/// <summary>
/// The definition of remote configuration source that brings dynamic changes to the configuration via polling.
/// </summary>
export interface IRemoteConfigurationSource extends IConfigurationSource
{
    /// <summary>
    /// Poll the configuration source to get the latest content.
    /// </summary>
    pollPropertiesAsync(timeoutInMs:number):Promise<PollResult> ;
}

export interface ILocalConfigurationSource extends IConfigurationSource {
    readPropertiesAsync(): Promise<PollResult>;
}