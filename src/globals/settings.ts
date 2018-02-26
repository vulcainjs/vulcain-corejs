import { VulcainLogger } from './../log/vulcainLogger';
import * as moment from 'moment';
import * as fs from 'fs';
import { Conventions } from '../utils/conventions';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer } from '../di/resolvers';
import { IStubManager, DummyStubManager } from "../stubs/istubManager";
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { IDynamicProperty } from '../configurations/abstractions';
import { Files } from '../utils/files';
import * as Path from 'path';
import { Service } from './system';

/**
 * Manage local file settings
 */
export class Settings {
    private _environment: "local" | "test" | "production";
    private _stubs: { [name: string]: string };
    private _config: { [name: string]: string };
    private _alias: { [name: string]: string };
    private _settings: { [name: string]: string };

    constructor() {
        this.readContext();
    }

    public get environment() {
        return this._environment;
    }

    public get stubSessions() {
        return this._stubs;
    }

    public async saveStubSessions(stubSessions: any): Promise<any> {
        if (!this._stubs) // production
            return;

        try {
            this._stubs.sessions = stubSessions;
            let path = Files.findConfigurationFile();
            if (!path)
                return;
            fs.writeFileSync(path, JSON.stringify(
                {
                    mode: this._environment,
                    alias: this._alias,
                    config: this._config,
                    stubs: this._stubs,
                    settings: this._settings
                }
            ));
        }
        catch (e) {
            Service.log.error(null, e, ()=> "VULCAIN MANIFEST : Error when savings stub sessions.");
        }
    }

    /**
     * Read configurations from vulcain file
     * Set env type from environment variable then vulcain config
     *
     * @private
     */
    private readContext() {
        this._alias = {};
        this._config = {};
        this._stubs = {};
        this._settings = {};

        // Default mode is local
        this._environment = <any>process.env[Conventions.instance.ENV_VULCAIN_ENV] || "local";
        if (this._environment === "production") {
            // Settings are ignored in production
            return;
        }

        try {
            let path = Files.findConfigurationFile();
            if (path) {
                let data:any = fs.readFileSync(path, "utf8");
                data = data && JSON.parse(data);
                if (data) {
                    this._settings = data.settings || this._settings;
                    this._alias = data.alias || this._alias;
                    this._config = data.config || this._config;
                    this._stubs = data.stubs || this._stubs;
                    this._environment = (<any>process.env[Conventions.instance.ENV_VULCAIN_ENV] || data.env || this._environment).toLowerCase();
                }
            }
        }
        catch (e) {
            throw new Error("VULCAIN MANIFEST : Loading error");
        }

        if ( this._environment !== "test" && this._environment !== "local") {
            throw new Error("Invalid environment. Should be 'production', 'test' or 'local'");
        }
    }

    /**
     * Check if the service is running in local mode
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    get isDevelopment() {
        return this._environment === "local";
    }

    /**
     * Check if the current service is running in test environnement
     *
     * @static
     * @returns
     *
     * @memberOf System
     */
    get isTestEnvironment() {
        return this.isDevelopment || this._environment === "test";
    }

    getSettings(name: string) {
        return <any>this._settings[name];
    }
    
    /**
     * Resolve service alias
     *
     * @param {string} name
     * @param {string} [version]
     * @returns null if no alias exists
     *
     * @memberOf System
     */
    getAlias(name: string, version?: string): string {
        if (!name || !Service.isDevelopment)
            return null;

        // Try to find an alternate uri
        let alias = this._alias[name];
        if (alias) {
            if (typeof alias === "string") {
                return alias;
            }
            alias = alias[version];
            if (alias)
                return alias;
        }

        return null;
    }
}
