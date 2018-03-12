import * as jaeger from 'jaeger-client';
const UDPSender = require('jaeger-client/dist/src/reporters/udp_sender').default;
import * as opentracing from 'opentracing';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { ITrackerAdapter, IRequestTrackerFactory } from './index';
import { IRequestContext } from "../../pipeline/common";
import { TrackerId, SpanKind, ISpanTracker } from '../../instrumentations/common';
import { Service } from '../../globals/system';

export class JaegerInstrumentation implements IRequestTrackerFactory {

    static create() {
        let jaegerAddress = DynamicConfiguration.getPropertyValue<string>("jaeger");
        if (jaegerAddress) {
            if (!jaegerAddress.startsWith("http://")) {
                jaegerAddress = "http://" + jaegerAddress;
            }
            if (!/:[0-9]+/.test(jaegerAddress)) {
                jaegerAddress = jaegerAddress + ':9411';
            }

            Service.log.info(null, () => `Enabling Jaeger instrumentation at ${jaegerAddress}`);

            const sender = new UDPSender();
            const tracer = new jaeger.Tracer(Service.fullServiceName,
                new jaeger.RemoteReporter(sender),
                new jaeger.RateLimitingSampler(1));

            return new JaegerInstrumentation(tracer);
        }
        return null;
    }

    constructor(private tracer) {
    }

    startSpan(span: ISpanTracker, name: string, action: string): ITrackerAdapter {
        const parentId = (span.context.requestTracker && span.context.requestTracker.id) || null;
        const parent = (parentId && new jaeger.SpanContext(null, null, null, parentId.correlationId, parentId.spanId, parentId.parentId, 0x01)) || null;
        return new JaegerRequestTracker(this.tracer, span.id, span.kind, name, action, parent);
    }
}

export class JaegerRequestTracker implements ITrackerAdapter {
    private rootSpan;

    get context() {
        return this.rootSpan.context();
    }

    constructor(tracer, id: TrackerId, kind: SpanKind, name: string, action: string, parent: any) {
        if (kind === SpanKind.Command) {
            this.rootSpan = tracer.startSpan(name + " " + action, {childOf: parent});
            this.rootSpan.setTag("event", "cs");
        }
        else if (kind === SpanKind.Event) {
            this.rootSpan = tracer.startSpan("Event " + action, { childOf: parent });
            this.rootSpan.setTag("event", "sr");
        }
        else if (kind === SpanKind.Task) {
            this.rootSpan = tracer.startSpan("Async " + action, { childOf: parent });
            this.rootSpan.setTag("event", "sr");
        }
        else if (kind === SpanKind.Request) {
            this.rootSpan = tracer.startSpan(action, { childOf: parent });
            this.rootSpan.setTag("event", "sr");
        }
        this.rootSpan._spanContext = new jaeger.SpanContext(null, null, null, id.correlationId, id.spanId, id.parentId, 0x01);
    }

    log(msg: string) {
        this.rootSpan.log({ message: msg });
    }

    addTag(name: string, value: string) {
        this.rootSpan.setTag(name, value);
    }

    trackError(error: Error, msg: string) {
        this.rootSpan.setTag(opentracing.Tags.ERROR, true);
        this.rootSpan.setTag("message", error.message);
        this.rootSpan.setTag("stack", error.stack);
        this.rootSpan.setTag("event", "error");
        this.log(msg || error.message);
    }

    finish() {
        this.rootSpan.finish();
    }
}