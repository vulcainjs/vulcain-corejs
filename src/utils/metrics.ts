import { System } from 'vulcain-configurationsjs';
import { Conventions } from './conventions';
import * as Statsd from "statsd-client";
import {Injectable, LifeTime} from '../di/annotations';

@Injectable(LifeTime.Singleton)
export class Metrics {

    private statsd: Statsd;
    private tags: string;

    constructor() {
        if (!System.isDevelopment) {
            this.statsd = new Statsd({ host: process.env[Conventions.instance.ENV_METRICS_AGENT] || Conventions.instance.defaultStatsdAddress, socketTimeout: Conventions.instance.defaultStatsdDelayInMs });
            this.tags = ",environment=" + System.environment + ",service=" + System.serviceName + ',version=' + System.serviceVersion;
        }
    }

    increment(metric:string, delta?:number) {
        this.statsd && this.statsd.increment(metric + this.tags, delta);
    }

    decrement(metric:string, delta?:number) {
        this.statsd && this.statsd.decrement(metric + this.tags, delta);
    }

    counter(metric:string, delta:number) {
        this.statsd && this.statsd.counter(metric + this.tags, delta);
    }

    gauge(metric:string, value:number) {
        this.statsd && this.statsd.gauge(metric + this.tags, value);
    }

    timing(metric:string, duration:number) {
        this.statsd && this.statsd.timing(metric + this.tags, duration);
    }
}