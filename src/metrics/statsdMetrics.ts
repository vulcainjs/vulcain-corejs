import { Conventions } from '../utils/conventions';
import * as Statsd from "statsd-client";
import { System } from './../configurations/globals/system';
import { IMetrics } from './metrics';

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

    constructor(address?: string) {
        if (!System.isDevelopment) {
            let host = System.resolveAlias(address || Conventions.instance.defaultStatsdAddress);
            host = host || address || Conventions.instance.defaultStatsdAddress;
            this.statsd = new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
            this.tags = ",service=" + System.serviceName + ',version=' + System.serviceVersion;
            this.tags = this.tags.replace(/:/g, '-');
            System.log.info(null, "Initialize statsd metrics adapter on '" + host + "' with initial tags : " + this.tags);
        }
    }

    encodeTags(...tags: Array<string>) {
        return "," + tags.map(t=> t.replace(/[:|,]/g, '-')).join(',');
    }

    increment(metric: string, customTags?: string, delta?: number) {
        this.statsd && this.statsd.increment(metric.toLowerCase() + this.tags + customTags , delta);
    }

    decrement(metric:string, customTags?: string, delta?:number) {
        this.statsd && this.statsd.decrement(metric.toLowerCase() + this.tags + customTags, delta);
    }

    counter(metric:string, delta:number, customTags?: string) {
        this.statsd && this.statsd.counter(metric.toLowerCase() + this.tags + customTags, delta);
    }

    gauge(metric:string, value:number, customTags?: string) {
        this.statsd && this.statsd.gauge(metric.toLowerCase() + this.tags + customTags, value);
    }

    timing(metric: string, duration: number, customTags?: string) {
        this.statsd && this.statsd.timing(metric.toLowerCase() + this.tags + customTags, duration);
    }
}
