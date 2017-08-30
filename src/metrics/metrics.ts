import { ApplicationInsightsMetrics } from './applicationInsightsMetrics';
import { StatsdMetrics } from './statsdMetrics';
import { PrometheusMetrics } from './prometheusMetrics';
import { IContainer } from '../di/resolvers';

export class MetricsConstant {
    static duration = "_duration";
    static failure = "_failure";
    static total = "_total";
    static allRequestsFailure = "requests_failure";
    static allRequestsDuration = "requests_duration";
    static allRequestsTotal = "requests_total";
}

/**
 * Metrics adapter interface
 *
 * @export
 * @interface IMetrics
 */
export interface IMetrics {
    /**
     * Increment a gauge
     *
     * @param {string} metric metric name
     * @param {number} [delta] default 1
     *
     * @memberOf IMetrics
     */
    increment(metric: string, customTags?: any, delta?: number);

    /**
     * Set a duration
     *
     * @param {string} metric metric name
     * @param {number} [delta] duration in ms
     *
     * @memberOf IMetrics
     */
    timing(metric: string, duration: number, customTags?: any);
}

export class MetricsFactory {
    static create(container: IContainer) {
        return new ApplicationInsightsMetrics().initialize() ||
               new StatsdMetrics().initialize() ||
               new PrometheusMetrics(container);
    }
}