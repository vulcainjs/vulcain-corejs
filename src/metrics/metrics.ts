
/**
 * Metrics adapter interface
 *
 * @export
 * @interface IMetrics
 */
export interface IMetrics {
    /**
     * Add custom tags
     * Replace existing tags
     *
     * @param {...Array<string>} tags array of string like <tag-name>=<tag-value>
     *
     * @memberOf Metrics
     */
    setTags(...tags: Array<string>);
    /**
     * Increment a gauge
     *
     * @param {string} metric metric name
     * @param {number} [delta] default 1
     *
     * @memberOf IMetrics
     */
    increment(metric: string, delta?: number);

    /**
     * Decrement a gauge
     *
     * @param {string} metric metric name
     * @param {number} [delta] default -1
     *      *
     * @memberOf IMetrics
     */
    decrement(metric: string, delta?: number);

    /**
     * Add value to a counter
     *
     * @param {string} metric metric name
     * @param {number} [delta] value to add
     *
     * @memberOf IMetrics
     */
    counter(metric: string, delta: number);

    /**
     *
     *
     * @param {string} metric metric name
     * @param {number} [delta] value to add
     *
     * @memberOf IMetrics
     */
    gauge(metric: string, value: number);

    /**
     * Set a duration
     *
     * @param {string} metric metric name
     * @param {number} [delta] duration in ms
     *
     * @memberOf IMetrics
     */
    timing(metric: string, duration: number);
}

