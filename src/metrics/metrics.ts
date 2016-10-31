
export interface IMetrics {
    /**
     * Add tags as an array of string like <tag-name>=<tag-value>
     *
     * @param {...Array<string>} tags
     *
     * @memberOf Metrics
     */
    setTags(...tags: Array<string>);
    increment(metric: string, delta?: number);

    decrement(metric: string, delta?: number);

    counter(metric: string, delta: number);

    gauge(metric: string, value: number);

    timing(metric: string, duration: number);
}

