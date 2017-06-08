import { System } from './../globals/system';
import { ConfigurationSource, PollResult, ConfigurationItem } from './configurationSource';
const rest = require('unirest');
const moment = require('moment');

export class HttpConfigurationSource implements ConfigurationSource
{
    protected lastUpdate: string;

    constructor(protected uri: string) {
    }

    protected prepareRequest(request) {
        return request;
    }

    protected createRequestUrl() {
        let uri = this.uri;
        if (this.lastUpdate) {
            uri = uri + "?lastUpdate=" + this.lastUpdate;
        }
        return uri;
    }

    async pollPropertiesAsync(timeoutInMs:number)
    {
        let self = this;
        return new Promise( ( resolve ) =>
        {
            let uri = this.createRequestUrl();

            try {
                let values;

                let request = rest.get(uri)
                    .headers({ 'Accept': 'application/json' })
                    .timeout(timeoutInMs);

                request = this.prepareRequest(request);

                request.end(function (response) {
                    if (response.status === 200 && response.body) {
                        if (response.body.error) {
                            if (!System.isDevelopment) {
                                System.log.info(null, ()=>`HTTP CONFIG : error when polling properties on ${uri} - ${response.body.error.message}`);
                            }
                        }
                        else {
                            values = new Map<string, ConfigurationItem>();
                            let data = response.body;
                            data.value && data.value.forEach(cfg => values.set(cfg.key, cfg));
                            self.lastUpdate = moment.utc().format();
                        }
                    }
                    else {
                        System.log.info(null, ()=>`HTTP CONFIG : error when polling properties on ${uri} - ${(response.error && response.error.message) || response.status}`);
                    }
                    resolve(values && new PollResult(self, values));
                });
            }
            catch (e) {
                System.log.info(null, ()=>`HTTP CONFIG : error when polling properties on ${uri} - ${e.message}`);
                resolve(null);
            }
        } );
    }
}