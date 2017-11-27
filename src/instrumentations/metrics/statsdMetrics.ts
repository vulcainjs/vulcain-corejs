import { Conventions } from '../../utils/conventions';
const Statsd = require("statsd-client");
import { System } from '../../globals/system';
import { IMetrics } from '../metrics';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';

/**
 * Default metrics adapter
 * Emit metrics on statsd
 *
 * @export
 * @class StatsdMetrics
 */
/*
export class StatsdMetrics implements IMetrics {
    private static EmptyString = "";
    private tags: any;

    constructor(private statsd) {
        this.tags = this.encodeTags({ service: System.serviceName, version: System.serviceVersion });
    }

    static create() {
        if (!System.isDevelopment) {
            let host = DynamicConfiguration.getPropertyValue<string>("statsd");
            if (host) {
                let instance = new StatsdMetrics(
                    new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs }));
                System.log.info(null, ()=>"Initialize statsd metrics adapter on '" + host + "' with initial tags : " + instance.tags);
                return this;
            }
        }
        return null;
    }

    private encodeTags(tags: { [key: string]: string }): any {
        if (!tags)
            return StatsdMetrics.EmptyString;
        return ',' + Object.keys(tags).map(key => key + '=' + tags[key].replace(/[:|,]/g, '-')).join(',');
    }

    gauge(metric: string, customTags?: any, delta?: number) {
        const tags = this.tags + this.encodeTags(customTags);
        this.statsd && this.statsd.increment(metric.toLowerCase() + tags, delta);
    }

    count(metric: string, customTags?: any, delta?: number) {
        const tags = this.tags + this.encodeTags(customTags);
        this.statsd && this.statsd.increment(metric.toLowerCase() + tags, delta);
    }

    timing(metric: string, duration: number, customTags?: any) {
        const tags = this.tags + this.encodeTags(customTags);
        this.statsd && this.statsd.timing(metric.toLowerCase() + tags, duration);
    }
}*/
