import { System } from '../../globals/system';
import { IMetrics } from '../metrics';

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

    gauge(metric: string, customTags?: any, delta?: number) {
        this.log(`METRICS: gauge    ${metric + this.tags + customTags} : ${delta || 1}`);
    }

    count(metric: string, customTags?: any, delta?: number) {
        this.log(`METRICS: counter    ${metric + this.tags + customTags} : ${delta||1}`);
    }

    timing(metric:string, duration:number, customTags?: string) {
        this.log(`METRICS: timing  ${metric + this.tags + customTags} : ${duration}ms`);
    }
}
