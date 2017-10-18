import * as rx from 'rxjs';
import { IDynamicProperty, ConfigurationItem, IConfigurationSource, IRemoteConfigurationSource, ILocalConfigurationSource, DataSource } from './abstractions';
import { DynamicProperty } from './properties/dynamicProperty';
import { PrioritizedSourceValue } from './sources/PrioritizedSourceValue';
import { ChainedDynamicProperty } from './properties/chainedPropertyValue';
import { FileConfigurationSource, ConfigurationDataType } from './sources/fileConfigurationSource';
import { System } from '../globals/system';
import { MockConfigurationSource } from './sources/memoryConfigurationSource';
import { EnvironmentVariableSource } from "./sources/environmentVariableSource";
import { Conventions } from '../utils/conventions';
import { Files } from '../utils/files';

export class ConfigurationManager {
    public isRunning: boolean;
    private _values: PrioritizedSourceValue;
    private _dynamicProperties = new Map<string, IDynamicProperty<any>>();
    private disposed: boolean;
    private _propertyChanged: rx.ReplaySubject<IDynamicProperty<any>>;
    private _environmentVariables: EnvironmentVariableSource = new EnvironmentVariableSource();

    get properties() {
        return this._dynamicProperties;
    }

    get propertyChanged(): rx.Observable<IDynamicProperty<any>> {
        if (!this._propertyChanged) {
            this._propertyChanged = new rx.ReplaySubject<IDynamicProperty<any>>(1);
        }
        return <rx.Observable<IDynamicProperty<any>>>this._propertyChanged;
    }

    constructor(
        public pollingIntervalInSeconds: number = 60,
        public sourceTimeoutInMs: number = 1500) {
    }

    getValueInSources(name: string) {
        if (!this._values) { // For testing
            this._values = new PrioritizedSourceValue();
        }
        let val = this._values.get(name);
        return val;
    }

    createDynamicProperty<T>(name: string, defaultValue?: T) {
        let dp = new DynamicProperty<T>(this, name, defaultValue);
        if (name) {
            dp.set(this.getValueInSources(name));
        }

        return dp;
    }

    createChainedDynamicProperty<T>(name: string, properties: Array<string>, defaultValue?: T) {
        properties = properties && properties.filter(n => !!n); // remove null property
        if (!properties || properties.length === 0)
            return this.createDynamicProperty(name, defaultValue);

        let dp = new ChainedDynamicProperty<T>(this, name, properties, defaultValue);
        dp.set(this.getValueInSources(name));
        return dp;
    }

    getValueFromEnvironmentVariable<T>(name: string): T {
        let val = this._environmentVariables.get(name);
        return <T>val;
    }

    getProperty<T>(name: string): IDynamicProperty<T> {
        let prop = this._dynamicProperties.get(name);
        if (!prop) {
            let v = this._environmentVariables.get(name);
            if (v !== undefined)
                prop = this.createDynamicProperty(name, v);
        }
        return prop;
    }

    /**
 * Initialize source(s) and return only when all sources are initialized
 * @param sources List of sources
 * @returns {Promise<T>}
 */
    async startPollingAsync(sources: IConfigurationSource | Array<IConfigurationSource> = [], pollSources = true) {
        let localSources: Array<IConfigurationSource> = [];
        let remoteSources: Array<IRemoteConfigurationSource> = [];

        if (!Array.isArray(sources)) {
            sources = [sources];
        }
        sources.push(new FileConfigurationSource(Files.findConfigurationFile(), ConfigurationDataType.VulcainConfig));

        for (let source of sources) {
            // Local properties has loaded first (less priority)
            if ((<ILocalConfigurationSource>source).readPropertiesAsync) {
                localSources.push(source);
                await (<ILocalConfigurationSource>source).readPropertiesAsync();
            }
            else {
                let s = source as IRemoteConfigurationSource;
                if (remoteSources.indexOf(s) < 0) {
                    remoteSources.push(s);
                }
            }
        }

        this._values = new PrioritizedSourceValue(localSources, remoteSources);

        // Run initialization
        let tries = 2;
        while (tries > 0) {
            if (await this.pollingAsync(3000, false)) {
                // All sources are OK
                if (pollSources)
                    this.repeatPolling();
                this.isRunning = true;
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
     * for test only
     */
    async forcePollingAsync(src?: IRemoteConfigurationSource, reset?: boolean) {
        if (reset)
            this._values = null;

        if (src) {
            if (!this._values) {
                this._values = new PrioritizedSourceValue([], [src]);
            }
            else {
                this._values.remoteSources.push(src);
            }
        }
        await this.pollingAsync(3000, false);
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
            let list = this._values.remoteSources;
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
        if (!data.values)
            return;
        for (let d of data.values) {
            let dp = this._dynamicProperties.get(d.key);
            if (!dp) {
                dp = this.createDynamicProperty(d.key);
            }
            else if ((<any>dp).updateValue) {
                (<any>dp).updateValue(d);
            }
        }
    }

    onPropertyChanged(dp: IDynamicProperty<any>) {
        this._propertyChanged && this._propertyChanged.next(dp);
    }

    private repeatPolling() {
        if (!this.disposed && this._values.remoteSources.length > 0)
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
        if (pollingIntervalInSeconds)
            this.pollingIntervalInSeconds = pollingIntervalInSeconds;
        if (sourceTimeoutInMs)
            this.sourceTimeoutInMs = sourceTimeoutInMs;

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