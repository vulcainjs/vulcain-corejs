import { System } from '../configurations/globals/system';

export class ConsoleMetrics {
    private tags: string;
    private customTags: string = "";

    constructor(address?: string) {
        this.tags = ",environment=" + System.environment + ",service=" + System.serviceName + ',version=' + System.serviceVersion;
    }

    /**
     * Add tags as an array of string like <tag-name>=<tag-value>
     *
     * @param {...Array<string>} tags
     *
     * @memberOf Metrics
     */
    setTags(...tags: Array<string>) {
        this.customTags = "," + tags.join(',');
    }

    increment(metric: string, delta?: number) {
        console.log(`METRICS: incr    ${metric + this.tags + this.customTags} : ${delta||1}`);
    }

    decrement(metric:string, delta?:number) {
        console.log(`METRICS: decr    ${metric + this.tags + this.customTags} : ${delta||-1}`);
    }

    counter(metric:string, delta:number) {
        console.log(`METRICS: counter ${metric + this.tags + this.customTags} : ${delta}`);
    }

    gauge(metric:string, value:number) {
        console.log(`METRICS: gauge   ${metric + this.tags + this.customTags} : ${value}`);
    }

    timing(metric:string, duration:number) {
        console.log(`METRICS: timing  ${metric + this.tags + this.customTags} : ${duration}ms`);
    }
}
