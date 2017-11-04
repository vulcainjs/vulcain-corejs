const jaeger = require('jaeger-client')
const UDPSender = require('jaeger-client/dist/src/reporters/udp_sender').default
import * as opentracing from 'opentracing';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IRequestTracker, IRequestTrackerFactory } from './index';
import { IRequestContext } from "../../pipeline/common";
import { TrackerId, SpanKind } from '../../trace/common';

export class JaegerInstrumentation implements IRequestTrackerFactory {

    static create() {
        let jaegerAddress = DynamicConfiguration.getPropertyValue<string>("jaeger");
        if (jaegerAddress) {
            if (!jaegerAddress.startsWith("http://")) {
                jaegerAddress = "http://" + jaegerAddress;
            }
            if (!/:[0-9]+/.test(jaegerAddress)) {
                jaegerAddress = jaegerAddress + ':9411;
            }

            return new JaegerInstrumentation();
        }
        return null;
    }

    constructor() {
    }

    startSpan(ctx: IRequestContext, id: TrackerId, name: string, kind: SpanKind, action: string): IRequestTracker {
        return new JaegerRequestTracker(name, id, kind, action);
    }
}

export class JaegerRequestTracker implements IRequestTracker {
    private _tracer: any;

    constructor(serviceName: string, id: TrackerId, kind: SpanKind, action: string) {
        let options: any = {};
        if (id.parentId)
            options.childOf = id.parentId;

        this._tracer = new jaeger.Tracer(serviceName, new jaeger.RemoteReporter(new UDPSender()), new jaeger.RateLimitingSampler(1), options);

        this.addTag("action", action);

        if (kind === SpanKind.Command)
            this._tracer.setTag("event", "cs");
        else if (kind === SpanKind.Event)
            this._tracer.setTag("event", "sr");
        else if (kind === SpanKind.Task)
            this._tracer.setTag("event", "sr");
        else if (kind === SpanKind.Request)
            this._tracer.setTag("event", "sr");
    }

    addTag(name: string, value: string) {
        this._tracer.setTag(name, value);
    }

    trackError(error: Error) {
        this._tracer.setTag(opentracing.Tags.ERROR, true);
        this._tracer.setTag("message", error.message);
        this._tracer.setTag("stack", error.stack);
        this._tracer.setTag("event", "error");
    }

    finish() {
        this._tracer.finish();
    }
}