import { System } from 'vulcain-configurationsjs';
import { Conventions } from './conventions';
import * as Statsd from "statsd-client";
import {Injectable, LifeTime} from '../di/annotations';

@Injectable(LifeTime.Singleton)
export class Metrics {

    private statsd: Statsd;
    private tags: string;

    constructor() {
        this.statsd = new Statsd({ host: process.env[Conventions.ENV_METRICS_AGENT] || "telegraf", socketTimeout: 10000 });
        this.tags = ",environment=" + System.environment + ",service=" + System.serviceName + ',version=' + System.serviceVersion;
    }

    increment(metric:string, delta?:number) {
        this.statsd.increment(metric + this.tags, delta);
    }

    decrement(metric:string, delta?:number) {
        this.statsd.decrement(metric + this.tags, delta);
    }

    counter(metric:string, delta:number) {
        this.statsd.counter(metric + this.tags, delta);
    }

    gauge(metric:string, value:number) {
        this.statsd.gauge(metric + this.tags, value);
    }

    timing(metric:string, duration:number) {
        this.statsd.timing(metric + this.tags, duration);
    }
}