import { Conventions } from '../utils/conventions';
import * as Statsd from "statsd-client";
import { System } from './../configurations/globals/system';
import { IMetrics, MetricsConstant } from './metrics';
import { IHttpAdapterRequest } from '../servers/abstractAdapter';
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
    private tags: string;
    private static EmptyString = "";

    constructor(address?: string) {
        if (!System.isDevelopment) {
            let host = DynamicConfiguration.getPropertyValue<string>("statsdAgent") || System.resolveAlias(address) || address;
            if (host) {
                this.statsd = new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
                this.tags = ",service=" + System.serviceName + ',version=' + System.serviceVersion;
                this.tags = this.tags.replace(/:/g, '-');
                System.log.info(null, "Initialize statsd metrics adapter on '" + host + "' with initial tags : " + this.tags);
            }
        }
    }

    encodeTags(...tags: Array<string>) {
        if (!tags || tags.length === 0)
            return StatsdMetrics.EmptyString;
        return "," + tags.map(t => t.replace(/[:|,]/g, '-')).join(',');
    }

    increment(metric: string, customTags?: string, delta?: number) {
        this.statsd && this.statsd.increment(metric.toLowerCase() + this.tags + (customTags || StatsdMetrics.EmptyString), delta);
    }

    decrement(metric: string, customTags?: string, delta?: number) {
        this.statsd && this.statsd.decrement(metric.toLowerCase() + this.tags + (customTags || StatsdMetrics.EmptyString), delta);
    }

    counter(metric: string, delta: number, customTags?: string) {
        this.statsd && this.statsd.counter(metric.toLowerCase() + this.tags + (customTags || StatsdMetrics.EmptyString), delta);
    }

    gauge(metric: string, value: number, customTags?: string) {
        this.statsd && this.statsd.gauge(metric.toLowerCase() + this.tags + (customTags || StatsdMetrics.EmptyString), value);
    }

    timing(metric: string, duration: number, customTags?: string) {
        this.statsd && this.statsd.timing(metric.toLowerCase() + this.tags + (customTags || StatsdMetrics.EmptyString), duration);
    }
}
