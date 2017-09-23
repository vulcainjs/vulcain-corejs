import { System } from './../globals/system';
import { IMetrics, MetricsConstant } from './metrics';
import * as Prometheus from 'prom-client';
import { IContainer } from "../di/resolvers";
import { HttpRequest } from "../pipeline/vulcainPipeline";
import { HttpResponse } from "../pipeline/response";
import { DefaultServiceNames } from '../di/annotations';
import { VulcainLogger } from '../log/vulcainLogger';

export class PrometheusMetrics implements IMetrics {
    private tags: any;
    private static Empty = {};

    constructor(private container: IContainer) {
        this.tags = this.encodeTags({ service: System.serviceName, version: System.serviceVersion });

        container.registerEndpoint( '/metrics', (req: HttpRequest) => {
            let res = new HttpResponse(Prometheus.register.metrics());
            res.contentType = (<any>Prometheus.Registry).contentType || "text/plain; version=0.0.4";
            return res;
        });
    }

    private encodeTags(tags: { [key: string] : string }): any {
        if (!tags)
            return PrometheusMetrics.Empty;

        Object.keys(tags)
            .forEach(key => key + '="' + (tags[key] || '').replace(/[:|,\.?&]/g, '_') + '"');
        return tags;
    }

    increment(metric: string, customTags?: any, delta = 1) {
        metric = 'vulcain_' + metric.replace(/[:|,\.?&-]/g, '_');
        let labels = Object.assign({}, this.tags, customTags);

        let counter:Prometheus.Counter = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Counter({ name: metric, help: metric, labelNames: Object.keys(labels) });
        }
        try {
            counter.inc(labels, delta);
        }
        catch (e) {
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.error(null, e, ()=>"Promotheus metrics")
        }
    }

    timing(metric: string, duration: number, customTags?: any) {
        metric = 'vulcain_' + metric.replace(/[:|,\.?&-]/g, '_'); // TODO
        let labels = Object.assign({}, this.tags, customTags);
        let counter:Prometheus.Histogram = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Histogram({ name: metric, help: metric, labelNames: Object.keys(labels) });
        }
        try {
            counter.observe(labels, duration);
        }
        catch (e) {
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.error(null, e, ()=>"Promotheus metrics")
        }
    }
}
