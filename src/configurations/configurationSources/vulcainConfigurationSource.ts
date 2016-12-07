import { System } from './../globals/system';
import { ConfigurationSource, PollResult, ConfigurationItem } from './configurationSource';
const rest = require('unirest');
const moment = require('moment');

export class VulcainConfigurationSource implements ConfigurationSource
{
    constructor(private uri: string, private options) {
        if (!System.vulcainToken && !System.isTestEnvironnment) {
            System.log.info(null, "No token defined for reading configuration properties. Vulcain configuration source is ignored.");
        }
    }

    async pollPropertiesAsync(timeoutInMs:number)
    {
        if (!System.vulcainToken && !System.isTestEnvironnment) {
            return Promise.resolve(new PollResult(this, null));
        }

        let self = this;
        return new Promise( ( resolve ) =>
        {
            let uri = this.uri + "?$query=" + JSON.stringify(this.options);

            try {
                let values;

                let request = rest.get(uri)
                    .headers({ 'Accept': 'application/json' })
                    .timeout(timeoutInMs);

                if (System.vulcainToken)
                    request = request.headers({ Authorization: 'ApiKey ' + System.vulcainToken });

                request.end(function (response) {
                    if (response.status === 200 && response.body) {
                        if (response.body.error) {
                            if (!System.isDevelopment) {
                                System.log.info(null, `HTTP CONFIG : error when polling properties on ${uri} - ${response.body.error.message}`);
                            }
                        }
                        else {
                            values = new Map<string, ConfigurationItem>();
                            let data = response.body;
                            data.value && data.value.forEach(cfg => values.set(cfg.key, cfg));
                            self.options.lastUpdate = moment.utc().format();
                            System.log.verbose(null, `HTTP CONFIG : polling properties on ${uri}`);
                        }
                    }
                    else {
                        System.log.info(null, `HTTP CONFIG : error when polling properties on ${uri} - ${(response.error && response.error.message) || response.status}`);
                    }
                    resolve(values && new PollResult(self, values));
                });
            }
            catch (e) {
                System.log.info(null, `HTTP CONFIG : error when polling properties on ${uri} - ${e.message}`);
                resolve(null);
            }
        } );
    }
}