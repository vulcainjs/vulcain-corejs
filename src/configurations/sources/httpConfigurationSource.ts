import { IRemoteConfigurationSource, DataSource, ConfigurationItem } from "../abstractions";
import { AbstractRemoteSource } from "./abstractRemoteSource";
import { Service } from "../../globals/system";

const rest = require('unirest');
const moment = require('moment');

export class HttpConfigurationSource extends AbstractRemoteSource {
    protected lastUpdate: string;

    constructor(protected uri: string) {
        super();
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

    async pollProperties(timeoutInMs: number) {
        let self = this;
        return new Promise<DataSource>((resolve) => {
            let uri = this.createRequestUrl();

            try {
                let values: Map<string, ConfigurationItem>;

                let request = rest.get(uri)
                    .headers({ 'Accept': 'application/json' })
                    .timeout(timeoutInMs);

                request = this.prepareRequest(request);

                request.end(function (response) {
                    if (response.status === 200 && response.body) {
                        if (response.body.error) {
                            if (!Service.isDevelopment) {
                                Service.log.info(null, () => `HTTP CONFIG : error when polling properties on ${uri} - ${response.body.error.message}`);
                            }
                        }
                        else {
                            values = new Map<string, ConfigurationItem>();
                            let data = response.body;
                            data.value && data.value.forEach(cfg => values.set(cfg.key, cfg));
                            self.lastUpdate = moment.utc().format();
                            self.mergeChanges(values);
                        }
                    }
                    else {
                        Service.log.info(null, () => `HTTP CONFIG : error when polling properties on ${uri} - ${(response.error && response.error.message) || response.status}`);
                    }
                    resolve(values && new DataSource(values.values()));
                });
            }
            catch (e) {
                Service.log.info(null, () => `HTTP CONFIG : error when polling properties on ${uri} - ${e.message}`);
                resolve(null);
            }
        });
    }
}