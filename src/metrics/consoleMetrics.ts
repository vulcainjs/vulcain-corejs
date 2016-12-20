import { System } from '../configurations/globals/system';
import { IMetrics } from './metrics';
import { IHttpAdapterRequest } from '../servers/abstractAdapter';
import { IRequestTracer } from './statsdMetrics';

/**
 * Metrics adapter for testing
 * Emit metrics on console
 *
 * @export
 * @class ConsoleMetrics
 */
export class ConsoleMetrics implements IMetrics {
    private tags: string;

    constructor(address?: string) {
        this.tags = ",environment=" + System.environment + ",service=" + System.serviceName + ',version=' + System.serviceVersion;
    }

    private log(msg: string) {
    }

    encodeTags(...tags: Array<string>) { }

    increment(metric: string, customTags?: string, delta?: number) {
        this.log(`METRICS: incr    ${metric + this.tags + customTags} : ${delta||1}`);
    }

    decrement(metric:string, customTags?: string, delta?:number) {
        this.log(`METRICS: decr    ${metric + this.tags + customTags} : ${delta||-1}`);
    }

    counter(metric:string, delta:number, customTags?: string) {
        this.log(`METRICS: counter ${metric + this.tags + customTags} : ${delta}`);
    }

    gauge(metric:string, value:number, customTags?: string) {
        this.log(`METRICS: gauge   ${metric + this.tags + customTags} : ${value}`);
    }

    timing(metric:string, duration:number, customTags?: string) {
        this.log(`METRICS: timing  ${metric + this.tags + customTags} : ${duration}ms`);
    }
}
