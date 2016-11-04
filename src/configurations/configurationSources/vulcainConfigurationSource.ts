import { System } from './../globals/system';
import { ConfigurationSource, PollResult, ConfigurationItem } from './configurationSource';
var rest = require('unirest');
var moment = require('moment');

export class VulcainConfigurationSource implements ConfigurationSource
{
    private token: string;

    constructor(private uri: string, private options) {
        this.token = System.vulcainToken;
    }

    async pollPropertiesAsync(timeoutInMs:number)
    {
        let self =this;
        return new Promise( ( resolve, reject ) =>
        {
            let uri = this.uri + "?$query=" + JSON.stringify(this.options);
            let values = new Map<string,ConfigurationItem>();

            let request = rest.get(uri)
                .headers({ 'Accept': 'application/json' })
                .timeout(timeoutInMs);

            if (this.token) {
                request = request.headers({ 'Authentication': 'Bearer ' + this.token });
            }
            request.end(function (response) {
                if (response.status === 200 && response.body) {
                    if (response.body.error) {
                        System.log.info(null, `HTTP CONFIG : error when polling properties on ${uri} - ${response.body.error.message}`);
                    }
                    else {
                        let data = response.body;
                        data.value && data.value.forEach(cfg => values.set(cfg.key, cfg));
                        self.options.lastUpdate = moment.utc().format();
                    }
                }
                else {
                    System.log.info(null, `HTTP CONFIG : error when polling properties on ${uri} - ${(response.error && response.error.message) || response.status}`);
                }
                resolve(new PollResult(self, values));
            } );
        } );
    }
}