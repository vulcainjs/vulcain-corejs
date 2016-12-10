import { System } from './../globals/system';
import { ConfigurationSource, PollResult, ConfigurationItem } from './configurationSource';
import { HttpConfigurationSource } from './httpConfigurationSource';
const rest = require('unirest');
const moment = require('moment');

export class VulcainConfigurationSource extends HttpConfigurationSource
{
    constructor(uri: string, private options) {
        super(uri);
        if (!System.vulcainToken && !System.isTestEnvironnment) {
            System.log.info(null, "No token defined for reading configuration properties. Vulcain configuration source is ignored.");
        }
    }

    protected prepareRequest(request) {
        if (System.vulcainToken)
            request = request.headers({ Authorization: 'ApiKey ' + System.vulcainToken });

        return request;
    }

    protected createRequestUrl() {
        this.options.lastUpdate = this.lastUpdate;
        return this.uri + "?$query=" + JSON.stringify(this.options);;
    }

    pollPropertiesAsync(timeoutInMs:number)
    {
        if (!System.vulcainToken && !System.isTestEnvironnment) {
            return Promise.resolve(new PollResult(this, null));
        }

        return super.pollPropertiesAsync(timeoutInMs);
    }
}