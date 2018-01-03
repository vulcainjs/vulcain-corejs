import { HttpConfigurationSource } from './httpConfigurationSource';
import { DataSource } from '../abstractions';
import { System } from '../../globals/system';
const rest = require('unirest');
const moment = require('moment');

export class VulcainConfigurationSource extends HttpConfigurationSource {

    constructor(uri: string, private options) {
        super(uri);
    }

    protected prepareRequest(request) {
        if(System.vulcainToken)
            request = request.headers({ Authorization: 'ApiKey ' + System.vulcainToken });
        return request;
    }

    protected createRequestUrl() {
        this.options.lastUpdate = this.lastUpdate;
        return this.uri + "?$query=" + JSON.stringify(this.options);;
    }

    pollProperties(timeoutInMs: number) {
        if (!System.vulcainToken && !System.isTestEnvironnment) {
            return Promise.resolve(null);
        }

        return super.pollProperties(timeoutInMs);
    }
}