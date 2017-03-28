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

    public source: ConfigurationSource;

    public constructor(source:ConfigurationSource, values?:Map<string,ConfigurationItem>)
    {
        this.source = source;
        this.values = values;
    }
}

/// <summary>
/// The definition of configuration source that brings dynamic changes to the configuration via polling.
/// </summary>
export interface ConfigurationSource
{
    /// <summary>
    /// Poll the configuration source to get the latest content.
    /// </summary>
    pollPropertiesAsync(timeoutInMs:number):Promise<PollResult> ;
}