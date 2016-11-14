import { System } from './../globals/system';
import { ConfigurationSource, ConfigurationDataType } from './configurationSource';
import { ConfigurationManager } from './configurationManager';
import { VulcainConfigurationSource } from './vulcainConfigurationSource';
import { FileConfigurationSource } from './fileConfigurationSource';

/**
 * Helper for adding configuration source providing by DynamicConfiguration.init
 */
export class ConfigurationSourceBuilder {
    private _sources: Array<ConfigurationSource>;

    constructor(private _configurationManager: ConfigurationManager) {
        this._sources = [];
    }

    public addSource(source: ConfigurationSource) {
        this._sources.push(source);
        return this;
    }

    public addVulcainSource() {
        if (!System.isDevelopment) {
            let uri = `http://${System.vulcainServer}/api/config.forservice`;
            let options = {
                cluster: System.environment,
                service: System.serviceName,
                version: System.serviceVersion,
                namespace: System.domainName
            };
            this.addSource(new VulcainConfigurationSource(uri, options));
        } else {
            // TODO init with .vulcain ?
        }
        return this;
    }

    /*public addRestSource(uri:string)
    {
        this.addSource(new HttpConfigurationSource(uri));
        return this;
    }*/

    public addFileSource(path: string, mode: ConfigurationDataType = ConfigurationDataType.Json) {
        this.addSource(new FileConfigurationSource(path, mode));
        return this;
    }

    public startPollingAsync() {
        return this._configurationManager.registerSourcesAsync(this._sources);
    }
}