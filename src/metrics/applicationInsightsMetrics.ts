import { IMetrics } from "./metrics";
import { Inject, DefaultServiceNames } from "../di/annotations";
import { IContainer } from "../di/resolvers";
import { System } from './../configurations/globals/system';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
const appInsights = require('applicationinsights');

export class ApplicationInsightsMetrics implements IMetrics {

    /**
     * service name, service version tags
     */
    private staticTags: any;

    constructor(private token?: string) {
    }

    initialize() {
        if (!System.isDevelopment) {
            let token = DynamicConfiguration.getPropertyValue<string>("appInsights") || this.token;
            if (token) {
                try {
                    appInsights.setup(token)
                        .setAutoDependencyCorrelation(true)
                        .setAutoCollectRequests(true)
                        .setAutoCollectPerformance(true)
                        .setAutoCollectExceptions(true)
                        .setAutoCollectDependencies(true) // mongodb, redis, mysql
                        .setAutoCollectConsole(false)
                        .start();
                    // this.statsd = new Statsd({ host: host, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
                    this.staticTags = this.encodeTags({ service: System.serviceName, version: System.serviceVersion });
                    System.log.info(null, () => "Initialize application insights metrics adapter with initial tags : " + this.staticTags);
                    return this;
                }
                catch (ex) {
                    System.log.error(null, ex, () => "Cannot initialize application insights metrics adapter with initial tags : " + this.staticTags);
                }
            }
        }
        return null;
    }

    private encodeTags(tags: { [key: string]: string }): any {
        if (!tags)
            return "";
        return ',' + Object.keys(tags).map(key => key + '=' + tags[key].replace(/[:|,]/g, '-')).join(',');
    }

    /**
     * Increment a counter metric
     * @param metric Metric name
     * @param customTags Object containing contextuel key value tags
     * @param delta Increment value
     */
    increment(metric: string, customTags?: any, delta: number = 1) {
        const tags = this.staticTags + this.encodeTags(customTags);
    }

    /**
     * Decrement a counter metric
     * @param metric Metric name
     * @param customTags Object containing contextuel key value tags
     * @param delta Decrement value
     */
    decrement(metric: string, customTags?: any, delta: number = -1) {
        const tags = this.staticTags + this.encodeTags(customTags);
    }

    /**
     * Track a timing value
     * @param metric Metric name
     * @param duration duration is ms
     * @param customTags Object containing contextuel key value tags
     */
    timing(metric: string, duration: number, customTags?: any) {
        const tags = this.staticTags + this.encodeTags(customTags);
    }
}