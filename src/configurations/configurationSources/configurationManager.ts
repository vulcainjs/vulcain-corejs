import { System } from './../globals/system';
import { IRemoteConfigurationSource, PollResult, IConfigurationSource, ILocalConfigurationSource } from './configurationSource';
import {DynamicProperty} from '../properties/dynamicProperty';
import {DynamicProperties} from "../properties/dynamicProperties";

export class ConfigurationManager
{
    private _sources:Array<IRemoteConfigurationSource> = [];
    private disposed:boolean;
    private _polling:boolean;

    constructor(
        private properties:DynamicProperties,
        public pollingIntervalInSeconds:number,
        public sourceTimeoutInMs:number )
    {
    }

    /**
     * Initialize source(s) and return only when all sources are initialized
     * @param sources List of sources
     * @returns {Promise<T>}
     */
    async startAsync( sources?:Array<IConfigurationSource>, pollSources=true )
    {
        if (sources) {
            sources.forEach(async source => {
                // Local properties has loaded first (less priority)
                if ((<ILocalConfigurationSource>source).readPropertiesAsync) {
                    let res = await (<ILocalConfigurationSource>source).readPropertiesAsync();
                    this.loadProperties(res);
                }
                else {
                    let s = source as IRemoteConfigurationSource;
                    if (this._sources.indexOf(s) < 0) {
                        this._sources.push(s);
                    }
                }
            });
        }

        // Run initialization
        let tries = 2;
        while (tries > 0) {
            if (await this.pollingAsync(3000, false)) {
                // All sources are OK
                if(pollSources)
                    this.repeatPolling();
                return;
            }

            tries--;
            if (tries)
                System.log.info(null, ()=>"CONFIG: Some dynamic properties sources failed. Retry polling.");
        }

        if (!System.isDevelopment) {
            throw new Error("CONFIG: Cannot read properties from sources. Program is stopped.");
        }
        else {
            System.log.info(null, ()=>"CONFIG: Cannot read properties from sources.");
        }
    }

    /**
     * Pull properties for all sources
     *
     * @private
     * @param {any} [timeout]
     * @returns
     *
     * @memberOf ConfigurationManager
     */
    async pollingAsync(timeout?: number, pollSources=true) {
        let ok = true;

        try {
            let list = this._sources;
            if (this.disposed || !list) return;

            let promises: Promise<PollResult>[] = [];
            list.forEach(src => {
                promises.push(
                    // pollPropertiesAsync cannot failed
                    src.pollPropertiesAsync(timeout || this.sourceTimeoutInMs)
                );
            });

            let results = await Promise.all(promises);
            // Ignore null result
            results.forEach(res => {
                if (!res) {
                    ok = false;
                }
                else
                    this.loadProperties(res);
            });
        }
        catch (e) {
            ok = false;
            System.log.error(null, e, ()=>"CONFIG: Error when polling sources");
        }

        // Restart
        if (pollSources)
            this.repeatPolling();

        return ok;
    }
    
    private repeatPolling() {
        setTimeout(this.pollingAsync.bind(this), this.pollingIntervalInSeconds * 1000);
    }

    private loadProperties( props:PollResult )
    {
        if (!props.values) {
            this.properties.clear();
            return;
        }

        props.values.forEach((item, key) => {
            if (!item || item.deleted) {
                System.log.info(null, ()=>"CONFIG: Removing property value for key " + key);
                this.properties.Updater_removeProperty(key);
                return;
            }

            try {
                let prop = this.properties.Updater_getOrCreate(key, () => {
                    return new DynamicProperty<any>(this.properties, key);
                });

                prop.set(item.encrypted ? System.decrypt(item.value) : item.value);
                let v = item.encrypted ? "********" : item.value;
                System.log.info(null, ()=>`CONFIG: Setting property value '${v}' for key ${key}`);
            }
            catch (e) {
                System.log.error(null, e, ()=> `CONFIG: Error on loadProperties for key ${key}`);
            }
        });
    }

    dispose()
    {
        this.disposed = true;
    }
}
