/*
import { IRemoteConfigurationSource, ConfigurationItem, DataSource } from "../abstractions";
import { System } from "../../System";
const Consul = require('consul');

export class ConsulConfigurationSource implements IRemoteConfigurationSource {
    // Local cache
    private _changes = new Map<string, ConfigurationItem>();
    private _allkeys = new Set<string>();
    private _initialized: boolean;
    private consul;
    private globalKeys: string;
    private serviceKey: string;
    private globalWatch;
    private serviceWatch;

    constructor(globalKeys?: string, serviceKey?: string, consulAddress?: string) {
        try {
            if (!globalKeys) {
                let env = System.environment;
                globalKeys = `vulcain/${env}/configurations/shared`;
            }
            this.globalKeys = globalKeys;

            if (!serviceKey) {
                let env = System.environment;
                let serviceName = System.serviceName;
                if (serviceName)
                    serviceKey = `vulcain/${env}/configurations/${serviceName}`;
            }
            this.serviceKey = serviceKey;

            this.consul = Consul({ host: consulAddress || "local-storage" });
        }
        catch (err) {
            System.log.error(null, err, () => "CONFIG: Error when using consul configuration source");
            this.consul = null;
        }
    }

    async pollProperties(timeoutInMs: number) {
        try {
            if (!this._initialized && this.consul) {
                if (timeoutInMs > 0)
                    this.consul.timeout = timeoutInMs;

                this._initialized = true;

                // First time, retrieve all
                this._changes = new Map<string, ConfigurationItem>();
                this._allkeys.clear();
                let data = await this.get(this.globalKeys);
                data && this.merge(this.globalKeys, data);
                if (this.serviceKey) {
                    data = await this.get(this.serviceKey);
                    data && this.merge(this.serviceKey, data);
                }
                this.watchDefinitionsChanges();
            }

            let result = new DataSource(this._changes);
            if (this._changes.size > 0)
                this._changes = new Map<string, ConfigurationItem>();
            return result;
        }
        catch (e) {
            System.log.error(null, e, () => "CONFIG: Consul configuration source.");
            this._initialized = true;
            return null;
        }
    }

    get(key: string) {
        return new Promise<any>((resolve, reject) => {
            try {
                this.consul.kv.get({ key: key, recurse: true }, (err, data) => {
                    if (err)
                        reject(err);
                    else {
                        resolve(data);
                    }
                }
                );
            }
            catch (e) {
                reject(e);
            }
        }
        );
    }

    private merge(prefix: string, data) {
        let max = 0;
        // Add new or existing keys
        data.filter(d => !d.Key.endsWith('/')).forEach(v => {
            let k = v.Key.substr(prefix.length + 1).replace('/', '.');
            if (v.Value) {
                try {
                    let item: ConfigurationItem = JSON.parse(v.Value);
                    this._changes.set(k, item);
                    this._allkeys.add(k);
                }
                catch (e) {
                    System.log.info(null, () => "CONFIG: Consul configuration source : Invalid json value for property " + k);
                }
            }
            if (v.ModifyIndex > max)
                max = v.ModifyIndex;
        }
        );

        // Remove deleted keys
        let keys = Array.from(this._allkeys.keys());
        for (let key of keys) {
            if (!this._changes.has(key)) {
                this._changes.set(key, null);
                this._allkeys.delete(key);
            }
        }
        return max;
    }

    private watchDefinitionsChanges() {
        this.globalWatch = this.watchChanges(this.globalKeys);
        if (this.serviceKey)
            this.serviceWatch = this.watchChanges(this.serviceKey);
    }

    private watchChanges(key: string) {
        let self = this;

        let watch = this.consul.watch({ method: this.consul.kv.get, options: { key: key, recurse: true } });

        // TODO modifyIndex
        watch.on('change', function (data, res) {
            data && System.log.info(null, () => "CONFIG: Detecting changes on configuration properties for consul key " + key);
            data && self.merge(key, data);
        }
        );

        watch.on('error', function (err) {
            System.log.error(null, err, () => "CONFIG: Error when watching configurations for " + key);
            self.globalWatch.end();
            self.serviceWatch && self.serviceWatch.end();
            self._initialized = false;
        }
        );
        return watch;
    }
}
*/