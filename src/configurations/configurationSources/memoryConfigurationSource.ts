import { IRemoteConfigurationSource, PollResult, ConfigurationItem } from './configurationSource';

export class MemoryConfigurationSource implements IRemoteConfigurationSource
{
    private _values = new Map<string, ConfigurationItem>();

    /// <summary>
    /// Set a update a new property
    /// </summary>
    /// <param name="name">Property name</param>
    /// <param name="value">Property value</param>
    set( name:string, value:any )
    {
        this._values.set( name, {key:name, value} );
    }

    pollPropertiesAsync( timeoutInMs:number ) :Promise<PollResult>
    {
        return new Promise<PollResult>((resolve) => {
            try {
                const values = this._values;
                resolve(new PollResult(this, values));
                if (this._values.size > 0)
                    this._values = new Map<string, any>();
            }
            catch (e) {
                resolve(null);
            }
        });
    }
}