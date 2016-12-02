
export class MetricsConstant {
    static duration = "_duration";
    static failure = "_failure";

    static allRequestsFailure = "requests_failure";
    static allRequestsDuration = "requests_duration";
}

/**
 * Metrics adapter interface
 *
 * @export
 * @interface IMetrics
 */
export interface IMetrics {

    encodeTags(...tags: Array<string>);

    /**
     * Increment a gauge
     *
     * @param {string} metric metric name
     * @param {number} [delta] default 1
     *
     * @memberOf IMetrics
     */
    increment(metric: string, customTags?: string, delta?: number);

    /**
     * Decrement a gauge
     *
     * @param {string} metric metric name
     * @param {number} [delta] default -1
     *      *
     * @memberOf IMetrics
     */
    decrement(metric: string, customTags?: string, delta?: number);

    /**
     * Add value to a counter
     *
     * @param {string} metric metric name
     * @param {number} [delta] value to add
     *
     * @memberOf IMetrics
     */
    counter(metric: string, delta: number, customTags?: string);

    /**
     *
     *
     * @param {string} metric metric name
     * @param {number} [delta] value to add
     *
     * @memberOf IMetrics
     */
    gauge(metric: string, value: number, customTags?: string);

    /**
     * Set a duration
     *
     * @param {string} metric metric name
     * @param {number} [delta] duration in ms
     *
     * @memberOf IMetrics
     */
    timing(metric: string, duration: number, customTags?: string);
}

