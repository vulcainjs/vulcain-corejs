import { IMetrics } from './metrics';
import { StatsdMetrics } from './statsdMetrics';
import { PrometheusMetrics } from './prometheusMetrics';

export class MetricsWrapper implements IMetrics {

    private metrics: IMetrics;

    constructor() {
        this.metrics = new StatsdMetrics().initialize() || new PrometheusMetrics();
    }

    increment(metric: string, customTags?: any, delta?: number) {
        this.metrics.increment(metric, customTags, delta);
    }
    decrement(metric: string, customTags?: any, delta?: number) {
        this.metrics.decrement(metric, customTags, delta);
    }
    timing(metric: string, duration: number, customTags?: any) {
        this.metrics.timing(metric, duration, customTags);
    }
}