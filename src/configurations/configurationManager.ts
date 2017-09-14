import * as rx from 'rxjs';
import { IDynamicProperty, ConfigurationItem, IConfigurationSource, IRemoteConfigurationSource, ILocalConfigurationSource, DataSource } from './abstractions';
import { DynamicProperty } from './properties/dynamicProperty';
import { PrioritizedSourceValue } from './properties/PrioritizedSourceValue';
import { ChainedDynamicProperty } from './properties/chainedPropertyValue';
import { FileConfigurationSource, ConfigurationDataType } from './sources/fileConfigurationSource';
import { System } from '../globals/system';

export class ConfigurationManager {
    private _remoteSources: Array<IRemoteConfigurationSource> = [];
    private _values: IConfigurationSource;
    private _dynamicProperties = new Map<string, DynamicProperty<any>>();
    private disposed: boolean;
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<any>>;

    get propertyChanged(): rx.Observable<IDynamicProperty<any>> {
        if (!this._propertyChanged) {
            this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<any>>(1);
        }
        return <rx.Observable<IDynamicProperty<any>>>this._propertyChanged;
    }

    constructor(
        public pollingIntervalInSeconds: number,
        public sourceTimeoutInMs: number) {
    }

    get(name: string, defaultValue) {
        if (!this._values) {
            this._values = new PrioritizedSourceValue();
        }
        let val = this._values.get(name);
        return val === undefined ? defaultValue : val;
    }

    createDynamicProperty<T>(name: string, defaultValue?: T) {
        let dp = new DynamicProperty<T>(this, name, defaultValue);
        if(name)
            this._dynamicProperties.set(name, dp);
        return dp;
    }

    createChainedDynamicProperty<T>( properties: Array<string>, defaultValue?: T) {
        let dp = new ChainedDynamicProperty<T>(this, properties, defaultValue);
        return dp;
    }

    getProperty<T>(name: string): IDynamicProperty<T> {
        return this._dynamicProperties.get(name);
    }

    /**
 * Initialize source(s) and return only when all sources are initialized
 * @param sources List of sources
 * @returns {Promise<T>}
 */
    async startPollingAsync(sources: IConfigurationSource | Array<IConfigurationSource> = [], pollSources = true) {
        let localSources: Array<IConfigurationSource> = [];
        if (!Array.isArray(sources)) {
            sources = [sources];
        }
        sources.push(new FileConfigurationSource(".vulcain", ConfigurationDataType.VulcainConfig));

        for(let source of sources) {
            // Local properties has loaded first (less priority)
            if ((<ILocalConfigurationSource>source).readPropertiesAsync) {
                localSources.push(source);
                await (<ILocalConfigurationSource>source).readPropertiesAsync();
            }
            else {
                let s = source as IRemoteConfigurationSource;
                if (this._remoteSources.indexOf(s) < 0) {
                    this._remoteSources.push(s);
                }
            }
        }

        this._values = new PrioritizedSourceValue(localSources, this._remoteSources);

        // Run initialization
        let tries = 2;
        while (tries > 0) {
            if (await this.pollingAsync(3000, false)) {
                // All sources are OK
                if (pollSources)
                    this.repeatPolling();
                return;
            }

            tries--;
            if (tries)
                System.log.info(null, () => "CONFIG: Some dynamic properties sources failed. Retry polling.");
        }

        if (!System.isDevelopment) {
            throw new Error("CONFIG: Cannot read properties from sources. Program is stopped.");
        }
        else {
            System.log.info(null, () => "CONFIG: Cannot read properties from sources.");
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
    async pollingAsync(timeout?: number, pollSources = true) {
        let ok = true;

        try {
            let list = this._remoteSources;
            if (this.disposed || !list) return;

            let promises: Promise<DataSource>[] = [];
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
                    this.onPropertiesChanged(res);
            });
        }
        catch (e) {
            ok = false;
            System.log.error(null, e, () => "CONFIG: Error when polling sources");
        }

        // Restart
        if (pollSources)
            this.repeatPolling();

        return ok;
    }

    onPropertiesChanged(data: DataSource) {
        data.values && data.values.forEach(d => {
            let dp = this._dynamicProperties.get(d.key);
            if (dp) {
                dp.updateValue(d);
            }
        });
    }

    onPropertyChanged(dp: IDynamicProperty<any>) {
        this._propertyChanged && this._propertyChanged.next(dp);
    }

    private repeatPolling() {
        if (!this.disposed && this._remoteSources.length > 0)
            setTimeout(this.pollingAsync.bind(this), this.pollingIntervalInSeconds * 1000);
    }

    /**
 /// Reset configuration and properties.
 /// All current properties will be invalid and all current sources will be lost.
 /// </summary>
 /// <param name="pollingIntervalInSeconds"></param>
 /// <param name="sourceTimeoutInMs"></param>
 */
    public reset(pollingIntervalInSeconds?: number, sourceTimeoutInMs?: number) {
        //this._propertyChanged.dispose();
        this._propertyChanged = null;

        let tmp = this._dynamicProperties;

        if (tmp) {
            for (let prop of tmp.values()) {
                if ((<any>prop).dispose)
                    (<any>prop).dispose();
            }
            tmp.clear();
        }
    }

    dispose() {
        this.reset();
        this.disposed = true;
    }
}