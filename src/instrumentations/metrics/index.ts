//import { ApplicationInsightsMetrics } from './applicationInsightsMetrics';
import { StatsdMetrics } from './statsdMetrics';
import { PrometheusMetrics } from './prometheusMetrics';
import { IContainer } from '../../di/resolvers';
import { DefaultServiceNames } from "../../di/annotations";

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
    increment(metric: string, customTags?: any, delta?: number): void;

    /**
     * Set a duration
     *
     * @param {string} metric metric name
     * @param {number} [delta] duration in ms
     *
     * @memberOf IMetrics
     */
    timing(metric: string, duration: number, customTags?: any): void;
}

export class MetricsFactory {
    static create(container: IContainer) {
        return container.get<IMetrics>(DefaultServiceNames.Metrics, true)  ||
         //      ApplicationInsightsMetrics.create() ||
               StatsdMetrics.create() ||
               new PrometheusMetrics(container);
    }
}