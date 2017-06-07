import { System } from './../configurations/globals/system';
import { IMetrics, MetricsConstant } from './metrics';
import * as Prometheus from 'prom-client';
import { IContainer } from "../di/resolvers";
import { IHttpAdapterRequest } from "../servers/abstractAdapter";
import { HttpResponse } from "../pipeline/response";

export class PrometheusMetrics implements IMetrics {
    private tags: any;
    private static Empty = {};

    constructor(container: IContainer) {
        this.tags = this.encodeTags({ service: System.serviceName, version: System.serviceVersion });
        container.registerEndpoint( '/metrics', (req: IHttpAdapterRequest) => {
            let res = new HttpResponse(Prometheus.register.metrics());
            res.contentType = (<any>Prometheus.Registry).contentType;
            return res;
        });
    }

    private encodeTags(tags: { [key: string] : string }): any {
        if (!tags)
            return PrometheusMetrics.Empty;

        Object.keys(tags)
            .forEach(key => key + '="' + (tags[key] || '').replace(/[:|,\.?&]/g, '-') + '"');
        return tags;
    }

    increment(metric: string, customTags?: any, delta = 1) {
        metric = 'vulcain' + metric;
        let labels = Object.assign(this.tags, customTags);

        let counter:Prometheus.Gauge = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Gauge(metric, metric, Object.keys(labels) );
        }

        counter.inc(labels, delta);
    }

    decrement(metric: string, customTags?: any, delta=1) {
        this.increment(metric, customTags, delta * -1);
    }

    timing(metric: string, duration: number, customTags?: any) {
        metric = 'vulcain' + metric;
        let labels = Object.assign(this.tags, customTags);
        let counter:Prometheus.Summary = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Summary(metric, metric, Object.keys(labels) );
        }

        counter.observe(labels, duration);
    }
}
