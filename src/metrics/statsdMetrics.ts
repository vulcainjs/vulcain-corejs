import { Conventions } from '../utils/conventions';
import * as Statsd from "statsd-client";
import { System } from './../configurations/globals/system';
import { IMetrics, MetricsConstant } from './metrics';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';

/**
 * Default metrics adapter
 * Emit metrics on statsd
 *
 * @export
 * @class StatsdMetrics
 */
export class StatsdMetrics implements IMetrics {

    private statsd: Statsd;
    private tags: any;
    private static EmptyString = "";

    constructor(private address?: string) {
    }

    initialize() {
        if (!System.isDevelopment) {
            let host = DynamicConfiguration.getPropertyValue<string>("statsdAgent") || System.resolveAlias(this.address) || this.address;
            if (host) {
                this.statsd = new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
                this.tags = this.encodeTags({ service: System.serviceName, version: System.serviceVersion });
                System.log.info(null, ()=>"Initialize statsd metrics adapter on '" + host + "' with initial tags : " + this.tags);
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

    increment(metric: string, customTags?: any, delta?: number) {
        const tags = this.tags + this.encodeTags(customTags);
        this.statsd && this.statsd.increment(metric.toLowerCase() + tags, delta);
    }

    timing(metric: string, duration: number, customTags?: any) {
        const tags = this.tags + this.encodeTags(customTags);
        this.statsd && this.statsd.timing(metric.toLowerCase() + tags, duration);
    }
}
