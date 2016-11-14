import { Conventions } from '../utils/conventions';
import * as Statsd from "statsd-client";
import { System } from './../configurations/globals/system';

/**
 * Default metrics adapter
 * Emit metrics on statsd
 *
 * @export
 * @class StatsdMetrics
 */
export class StatsdMetrics {

    private statsd: Statsd;
    private tags: string;
    private customTags: string = "";

    constructor(address?: string) {
        if (!System.isDevelopment) {
            let host = System.resolveAlias(address || Conventions.instance.defaultStatsdAddress);
            host = host || address || Conventions.instance.defaultStatsdAddress;
            this.statsd = new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
            this.tags = ",environment=" + System.environment + ",service=" + System.serviceName + ',version=' + System.serviceVersion;
            System.log.info(null, "Initialize statsd metrics adapter on '" + host + "' with initial tags : " + this.tags);
        }
    }

    /**
     * Add tags as an array of string like <tag-name>=<tag-value>
     *
     * @param {...Array<string>} tags
     *
     * @memberOf Metrics
     */
    setTags(...tags: Array<string>) {
        this.customTags = "," + tags.join(',');
    }

    increment(metric: string, delta?: number) {
        this.statsd && this.statsd.increment(metric + this.tags + this.customTags , delta);
    }

    decrement(metric:string, delta?:number) {
        this.statsd && this.statsd.decrement(metric + this.tags + this.customTags, delta);
    }

    counter(metric:string, delta:number) {
        this.statsd && this.statsd.counter(metric + this.tags + this.customTags, delta);
    }

    gauge(metric:string, value:number) {
        this.statsd && this.statsd.gauge(metric + this.tags + this.customTags, value);
    }

    timing(metric:string, duration:number) {
        this.statsd && this.statsd.timing(metric + this.tags + this.customTags, duration);
    }
}
