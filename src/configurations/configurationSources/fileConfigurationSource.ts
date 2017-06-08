import { ConfigurationSource, PollResult, ConfigurationDataType, ConfigurationItem } from './configurationSource';
import { System } from './../globals/system';
import * as fs from 'fs';
import * as readline from 'readline';

export class FileConfigurationSource implements ConfigurationSource
{
    private _values=new Map<string,ConfigurationItem>();
    private _lastAccess: number;
    private _disabled: boolean;

    constructor(private path: string, private mode: ConfigurationDataType = ConfigurationDataType.Json) {
        try {
            if (!fs.existsSync(path)) {
                System.log.info(null, ()=>"CONFIGURATIONS : File " + path + " doesn't exist.");
                this._disabled = true;
            }
        }
        catch (e) {
            System.log.error(null, e, ()=>"Invalid path when reading file configuration source at " + path + ". Are you using an unmounted docker volume ?");
        }
    }

    protected readValuesFromFile() {
        return new Promise((resolve) => {
            fs.stat(this.path, async (err, stats) => {
                if (!err) {
                    if (!this._lastAccess || this._lastAccess < stats.mtime.getTime()) {
                        this._lastAccess = stats.mtime.getTime();
                        if (this.mode === ConfigurationDataType.Json)
                            await this.readJsonValues();
                        else
                            await this.readKeyValues();
                    }
                }
                resolve(true);
            });
        });
    }

    protected readJsonValues() {
        return new Promise((resolve) => {
            fs.readFile(this.path, "utf-8", (err, data) => {
                if (!err) {
                    try {
                        let obj = JSON.parse(data);
                        for(let key of Object.keys(obj)) {
                            let encrypted = false;
                            let val = <any>obj[key];
                            if( typeof val === "object") {
                                val = val.value;
                                encrypted = val.encrypted;
                            }
                            this._values.set(key, {key, value:val, encrypted});
                        }
                        resolve(true);
                        return;
                    }
                    catch (e) {
                        err = e;
                    }
                }
                System.log.error(null, err, ()=>"File configuration source - Error when reading json values");
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
                    input: fs.createReadStream(self.path, 'UTF-8')
                });

                rl.on('line', function (line:string) {
                    if (line) {
                        try {
                            let m = line.match(re);
                            if (m) {
                                let encrypted = false;
                                let val = m[2] && m[2].trim().replace(/^"|"$/g, '');
                                if(val && val[0]==="!") {
                                    val = val.substr(1);
                                    encrypted = true;
                                }
                                self._values.set(m[1], {value:val, key: m[1], encrypted});
                            }
                        }
                        catch (err) {
                            System.log.error(null, err, ()=> `File configuration source - Error when reading key values line ${line}`);
                        }
                    }
                });

                rl.on('close', () => resolve(true));

            }
            catch (err) {
                System.log.error(null, err, ()=>"File configuration source - Error when reading key values");
                resolve(false);
            }
        });
    }

    async pollPropertiesAsync( timeoutInMs:number )
    {
        try {
            if (!this._disabled)
                await this.readValuesFromFile();
            const values = this._values;
            if (this._values.size > 0)
                this._values = new Map<string, any>();
            return new PollResult(this, values);
        }
        catch (e) {
            return null;
        }
    }
}