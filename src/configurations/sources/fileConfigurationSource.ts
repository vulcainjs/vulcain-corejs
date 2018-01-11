import { ILocalConfigurationSource, ConfigurationItem, DataSource } from '../abstractions';
import * as fs from 'fs';
import * as readline from 'readline';
import { Service } from '../../globals/system';
import * as Path from 'path';
import { Files } from '../../utils/files';

export enum ConfigurationDataType {
    KeyValue,
    Json,
    VulcainConfig
}

export class FileConfigurationSource implements ILocalConfigurationSource {
    private _values = new Map<string, ConfigurationItem>();
    private _disabled: boolean = false;

    constructor(private path: string, private mode: ConfigurationDataType = ConfigurationDataType.Json) {
        if (!path) {
            this._disabled = true;
            return;
        }

        try {
            if (!fs.existsSync(this.path)) {
                Service.log.info(null, () => "CONFIGURATIONS : File " + path + " doesn't exist.");
                this._disabled = true;
            }
        }
        catch (e) {
            Service.log.error(null, e, () => "Invalid path when reading file configuration source at " + this.path + ". Are you using an unmounted docker volume ?");
        }
    }

    get(name: string) {
        let item = this._values.get(name);
        if (item) return item.value;
        return undefined;
    }

    protected readJsonValues(vulcainConfig: boolean) {
        return new Promise((resolve) => {
            fs.readFile(this.path, "utf-8", (err, data) => {
                if (!err) {
                    try {
                        let obj = data && JSON.parse(data);
                        obj = obj && vulcainConfig ? obj.config : obj;
                        if (obj) {
                            for (let key of Object.keys(obj)) {
                                let encrypted = false;
                                let val = <any>obj[key];
                                if (typeof val === "object") {
                                    val = val.value;
                                    encrypted = val.encrypted;
                                }
                                this.updateValue(key, val, encrypted);
                            }
                        }
                        resolve(true);
                        return;
                    }
                    catch (e) {
                        err = e;
                    }
                }
                Service.log.error(null, err, () => "File configuration source - Error when reading json values");
                resolve(false);
            });
        });
    }

    protected readKeyValues() {
        const re = /^\s*([\w\$_][\d\w\._\-\$]*)\s*=\s*(.*)/;
        let self = this;
        return new Promise((resolve) => {
            try {
                const rl = readline.createInterface({
                    input: fs.createReadStream(self.path, { encoding: 'UTF-8' })
                });

                rl.on('line', function (line: string) {
                    if (line) {
                        try {
                            let m = line.match(re);
                            if (m) {
                                let encrypted = false;
                                let val = (m[2] && m[2].trim().replace(/^"|"$/g, '')) || null;
                                if (val && val[0] === "!") {
                                    val = val.substr(1);
                                    encrypted = true;
                                }
                                self.updateValue(m[1], val, encrypted);
                            }
                        }
                        catch (err) {
                            Service.log.error(null, err, () => `File configuration source - Error when reading key values line ${line}`);
                        }
                    }
                });

                rl.on('close', () => resolve(true));

            }
            catch (err) {
                Service.log.error(null, err, () => "File configuration source - Error when reading key values");
                resolve(false);
            }
        });
    }

    protected updateValue(name: string, value, encrypted: boolean) {
        this._values.set(name, { value: encrypted ? Service.decrypt(value) : value, encrypted, key: name });
        let v = encrypted ? "********" : value;
        Service.log.info(null, () => `CONFIG: Setting property value '${v}' for key ${name}`);
    }

    readProperties() {
        if (this._disabled)
            return;

        return new Promise<DataSource>((resolve) => {
            try {
                fs.stat(this.path, async (err, stats) => {
                    if (!err) {
                        if (this.mode === ConfigurationDataType.KeyValue)
                            await this.readKeyValues();
                        else
                            await this.readJsonValues(this.mode === ConfigurationDataType.VulcainConfig);
                    }
                    resolve(new DataSource(this._values.values()));
                });
            }
            catch (ex) {

            }
        });
    }
}