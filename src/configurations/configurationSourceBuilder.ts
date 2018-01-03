import { ConfigurationManager } from './configurationManager';
import { IConfigurationSource, IRemoteConfigurationSource } from './abstractions';
import { ConfigurationDataType, FileConfigurationSource } from './sources/fileConfigurationSource';
import { VulcainConfigurationSource } from './sources/vulcainConfigurationSource';
import { Service } from '../globals/system';

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
        if (Service.vulcainServer) {
            if (!Service.vulcainToken && !Service.isTestEnvironment) {
                Service.log.info(null, () => "No token defined for reading configuration properties. Vulcain configuration source is ignored.");
            }
            else {
                let uri = `http://${Service.vulcainServer}/api/configforservice`;
                let options = {
                    environment: Service.environment,
                    service: Service.serviceName,
                    version: Service.serviceVersion,
                    domain: Service.domainName
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