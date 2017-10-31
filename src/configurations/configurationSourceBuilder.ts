import { ConfigurationManager } from './configurationManager';
import { IConfigurationSource, IRemoteConfigurationSource } from './abstractions';
import { ConfigurationDataType, FileConfigurationSource } from './sources/fileConfigurationSource';
import { VulcainConfigurationSource } from './sources/vulcainConfigurationSource';
import { System } from '../globals/system';

/**
 * Helper for adding configuration source providing by DynamicConfiguration.init
 */
export class ConfigurationSourceBuilder {
    private _sources: Array<IConfigurationSource>;

    constructor(private _configurationManager: ConfigurationManager) {
        this._sources = [];
        this.addVulcainSource();
    }

    public addSource(source: IRemoteConfigurationSource) {
        this._sources.push(source);
        return this;
    }

    private addVulcainSource() {
        if (System.vulcainServer) {
            if (!System.vulcainToken && !System.isTestEnvironnment) {
                System.log.info(null, () => "No token defined for reading configuration properties. Vulcain configuration source is ignored.");
            }
            else {
                let uri = `http://${System.vulcainServer}/api/configforservice`;
                let options = {
                    environment: System.environment,
                    service: System.serviceName,
                    version: System.serviceVersion,
                    domain: System.domainName
                };
                this.addSource(new VulcainConfigurationSource(uri, options));
            }
        }

        return this;
    }

    /*public addRestSource(uri:string)
    {
        this.addSource(new HttpConfigurationSource(uri));
        return this;
    }*/

    public addFileSource(path: string, mode: ConfigurationDataType = ConfigurationDataType.Json) {
        this._sources.push(new FileConfigurationSource(path, mode));
        return this;
    }

    public startPolling() {
        return this._configurationManager.startPolling(this._sources);
    }
}