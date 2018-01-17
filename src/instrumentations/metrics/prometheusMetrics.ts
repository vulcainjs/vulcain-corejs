import { Service } from '../../globals/system';
import { IMetrics } from '../metrics';
import * as Prometheus from 'prom-client';
import { IContainer } from "../../di/resolvers";
import { HttpRequest } from "../../pipeline/vulcainPipeline";
import { HttpResponse } from "../../pipeline/response";
import { DefaultServiceNames } from '../../di/annotations';
import { VulcainLogger } from '../../log/vulcainLogger';

// Avg per seconds
//  rate(vulcain_service_duration_seconds_sum[5m]) / rate(vulcain_service_duration_seconds_count[5m])
// Failed service
//  rate(vulcain_service_duration_seconds_count{hasError="true"}[5m])
export class PrometheusMetrics implements IMetrics {

    private ignoredProperties = ["hystrixProperties", "params"];

    constructor(private container: IContainer) {

        container.registerEndpoint( '/metrics', (req: HttpRequest) => {
            let res = new HttpResponse(Prometheus.register.metrics());
            res.contentType = (<any>Prometheus).contentType || "text/plain; version=0.0.4";
            return res;
        });
    }

    private encodeTags(tags: { [key: string] : string }): any {
        let result = { service: Service.serviceName, version: Service.serviceVersion, serviceFullName: Service.fullServiceName };
        Object
            .keys(tags)
            .forEach(key => {
                if (this.ignoredProperties.indexOf(key) >= 0)
                    return;
                result[key.replace(/[^a-zA-Z_]/g, '_')] = tags[key];
            });
        return result;
    }

    gauge(metric: string, value: number, customTags?: any) {
        let labels = this.encodeTags(customTags);

        let gauge:Prometheus.Gauge = (<any>Prometheus.register).getSingleMetric(metric);
        if (!gauge) {
            gauge = new Prometheus.Gauge({ name: metric, help: metric, labelNames: Object.keys(labels) });
        }
        try {
            gauge.inc(labels, value);
        }
        catch (e) {
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.error(null, e, ()=>"Prometheus metrics")
        }
    }

    count(metric: string, customTags?: any, delta = 1) {
        let labels = this.encodeTags(customTags);

        let counter:Prometheus.Counter = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Counter({ name: metric, help: metric, labelNames: Object.keys(labels) });
        }
        try {
            counter.inc(labels, delta);
        }
        catch (e) {
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.error(null, e, ()=>"Prometheus metrics")
        }
    }

    timing(metric: string, duration: number, customTags?: any) {
        let labels = this.encodeTags(customTags);
        let counter:Prometheus.Histogram = (<any>Prometheus.register).getSingleMetric(metric);
        if (!counter) {
            counter = new Prometheus.Histogram({ name: metric, help: metric, labelNames: Object.keys(labels), buckets: [50,100,250,500,1000,1500,2000,5000], });
        }
        try {
            counter.observe(labels, duration);
        }
        catch (e) {
            let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.error(null, e, ()=>"Prometheus metrics")
        }
    }
}
