import { IMetrics } from "./metrics";
import { Inject, DefaultServiceNames } from "../di/annotations";
import { IContainer } from "../di/resolvers";
import { System } from './../configurations/globals/system';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
const appInsights = require('applicationinsights');

export class ApplicationInsightsMetrics implements IMetrics {

    constructor(private token?: string) {
    }

    initialize() {
        if (!System.isDevelopment) {
            let token = DynamicConfiguration.getPropertyValue<string>("appInsights") || this.token;
            if (token) {
                try {
                    appInsights.setup(token)
                        .setAutoDependencyCorrelation(true)
                        .setAutoCollectRequests(false)
                        .setAutoCollectPerformance(true)
                        .setAutoCollectExceptions(true)
                        .setAutoCollectDependencies(true) // mongodb, redis, mysql
                        .setAutoCollectConsole(false)
                        .start();

                    appInsights.client.commonProperties = {service: System.serviceName, version: System.serviceVersion };
                    System.log.info(null, () => "Initialize application insights metrics adapter ");
                    return this;
                }
                catch (ex) {
                    System.log.error(null, ex, () => "Cannot initialize application insights metrics adapter");
                }
            }
        }
        return null;
    }

    /**
     * Increment a counter metric
     * @param metric Metric name
     * @param customTags Object containing contextuel key value tags
     * @param delta Increment value
     */
    increment(metric: string, customTags?: any, delta: number = 1) {
    }

    /**
     * Track a timing value
     * @param metric Metric name
     * @param duration duration is ms
     * @param customTags Object containing contextuel key value tags
     */
    timing(metric: string, duration: number, customTags?: any) {
    }
}