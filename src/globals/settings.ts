import { VulcainLogger } from './../log/vulcainLogger';
import * as moment from 'moment';
import * as fs from 'fs';
import { Conventions } from '../utils/conventions';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer } from '../di/resolvers';
import { IMockManager, DummyMockManager } from "../mocks/imockManager";
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { IDynamicProperty } from '../configurations/abstractions';
import { Files } from '../utils/files';
import * as Path from 'path';
import { System } from './system';

/**
 * Static class providing service helper methods
 *
 * @export
 * @class System
 */
export class Settings {
    private _environmentMode: "local" | "test" | "production";
    private _mocks: { [name: string]: string };
    private _config: { [name: string]: string };
    private _alias: { [name: string]: string };

    constructor() {
        this.readContext();
    }

    public get environmentMode() {
        return this._environmentMode;
    }

    public get mockSessions() {
        return this._mocks;
    }

    public async saveMocks(mockSessions: any): Promise<any> {
        if (!this._mocks) // production
            return;

        try {
            this._mocks.sessions = mockSessions;
            let path = Files.findConfigurationFile();
            if (!path)
                return;
            fs.writeFileSync(path, JSON.stringify(
                {
                    mode: this._environmentMode,
                    alias: this._alias,
                    config: this._config,
                    mocks: this._mocks
                }
            ));
        }
        catch (e) {
            System.log.error(null, e, ()=> "VULCAIN MANIFEST : Error when savings mock sessions.");
        }
    }

    /**
     * Read configurations from .vulcain file
     * Set env type from environment variable then .vulcain config
     *
     * @private
     */
    private readContext() {
        this._alias = {};
        this._config = {};
        this._mocks = {};

        // Default mode is local
        this._environmentMode = <any>process.env[Conventions.instance.ENV_VULCAIN_ENV_MODE] || "local";
        if (this._environmentMode === "production") {
            // Settings are ignored in production
            return;
        }

        try {
            let path = Files.findConfigurationFile();
            if (path) {
                let data:any = fs.readFileSync(path, "utf8");
                data = data && JSON.parse(data);
                if (data) {
                    this._alias = data.alias || this._alias;
                    this._config = data._config || this._config;
                    this._mocks = data._mocks || this._mocks;
                    this._environmentMode = (data.mode || this._environmentMode).toLowerCase();
                }
            }
        }
        catch (e) {
            throw new Error("VULCAIN MANIFEST : Loading error");
        }

        if ( this._environmentMode !== "test" && this._environmentMode !== "local") {
            throw new Error("Invalid environment mode. Should be 'production', 'test' or 'local'");
        }
    }

    /**
     * Check if the service is running in local mode (on developper desktop)
     * by checking if a '.vulcain' file exists in the working directory
     *
     * @readonly
     * @static
     *
     * @memberOf System
     */
    get isDevelopment() {
        return this._environmentMode === "local";
    }

    /**
     * Check if the current service is running in a test environnement (VULCAIN_TEST=true)
     *
     * @static
     * @returns
     *
     * @memberOf System
     */
    get isTestEnvironnment() {
        return this.isDevelopment || this._environmentMode === "test";
    }

    /**
     * Resolve un alias (configuration key shared/$alternates/name-version)
     *
     * @param {string} name
     * @param {string} [version]
     * @returns null if no alias exists
     *
     * @memberOf System
     */
    getAlias(name: string, version?: string): string {
        if (!name || !System.isDevelopment)
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
