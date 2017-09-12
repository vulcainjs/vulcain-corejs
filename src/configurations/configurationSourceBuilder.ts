import { ConfigurationManager } from './configurationManager';
import { IConfigurationSource, IRemoteConfigurationSource } from './abstractions';
import { ConfigurationDataType, FileConfigurationSource } from './sources/fileConfigurationSource';
import { VulcainConfigurationSource } from './sources/vulcainConfigurationSource';
const System = require('../System');

/**
 * Helper for adding configuration source providing by DynamicConfiguration.init
 */
export class ConfigurationSourceBuilder {
    private _sources: Array<IConfigurationSource>;

    constructor(private _configurationManager: ConfigurationManager) {
        this._sources = [];
    }

    public addSource(source: IRemoteConfigurationSource) {
        this._sources.push(source);
        return this;
    }

    public addVulcainSource() {
        if (System.vulcainServer) {
            if (!System.vulcainToken && !System.isTestEnvironnment) {
                System.log.info(null, () => "No token defined for reading configuration properties. Vulcain configuration source is ignored.");
            }
            else {
                let uri = `http://${System.vulcainServer}/api/config.forservice`;
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

    public startPollingAsync() {
        return this._configurationManager.startAsync(this._sources);
    }
}