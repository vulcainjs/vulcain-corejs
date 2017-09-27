import { System } from '../../globals/system';
import { Conventions } from '../../utils/conventions';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IRequestTracker, IRequestTrackerFactory } from './index';
import { RequestContext } from "../../pipeline/requestContext";
import * as os from 'os';
import { IRequestContext } from "../../pipeline/common";
import { SpanId, SpanKind } from '../../trace/common';

const {
    Annotation,
    HttpHeaders: Header,
    option: {Some, None},
    TraceId, Tracer, ExplicitContext, ConsoleRecorder, BatchRecorder
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');

/**
 * Needs a property named : zipkinAgent
 */
export class ZipkinInstrumentation implements IRequestTrackerFactory {

    static create() {
        let zipkinAddress = DynamicConfiguration.getPropertyValue<string>("zipkin");
        if (zipkinAddress) {
            if (!zipkinAddress.startsWith("http://")) {
                zipkinAddress = "http://" + zipkinAddress;
            }
            if (!/:[0-9]+/.test(zipkinAddress)) {
                zipkinAddress = zipkinAddress + ':9411';
            }
            const recorder = new BatchRecorder({
                logger: new HttpLogger({
                    endpoint: `${zipkinAddress}/api/v1/spans`,
                    httpInterval: 10000
                })
            });
            return new ZipkinInstrumentation(recorder );
        }
        return null;
    }

    constructor(private recorder) {
    }

    startSpan(ctx: IRequestContext, id: SpanId, name: string, kind: SpanKind, action: string, tags): IRequestTracker {
        return new ZipkinRequestTracker(this.recorder, id, kind, name, action, tags);
    }
}

class ZipkinRequestTracker implements IRequestTracker {
    private tracer;
    private id: any;

    constructor(recorder, spanId: SpanId, private kind: SpanKind, private name: string, private action: string, tags) {
        this.tracer = new Tracer({ ctxImpl: new ExplicitContext(), recorder })

        this.id = new TraceId({
            traceId: new Some(spanId.traceId),
            spanId: spanId.spanId,
            parentId: spanId.parentId ? new Some(spanId.parentId) : None,
            Sampled: None,
            Flags: 0
        });

       // console.log(`Start span ${name}, action ${action}, id: ${this.id}; kind: ${kind}`);

        this.tracer.setId(this.id);
        this.tracer.recordRpc(action);
        this.tracer.recordServiceName(name);
        this.tracer.recordLocalAddr(os.hostname());

        if (kind === SpanKind.Command)
            this.tracer.recordAnnotation(new Annotation.ClientSend());
        else if (kind === SpanKind.Event)
            this.tracer.recordAnnotation(new Annotation.ServerRecv());
        else if (kind === SpanKind.Task)
            this.tracer.recordAnnotation(new Annotation.ServerRecv());
        else if (kind === SpanKind.Request)
            this.tracer.recordAnnotation(new Annotation.ServerRecv());

        this.setTags(tags);
    }

    private setTags(tags) {
        Object.keys(tags).forEach(k => {
            this.tracer.recordBinary(k, tags[k]);
        });
    }

    trackError(error, tags) {
        this.tracer.recordBinary("error", error.message || error);
        this.setTags(tags);
    }

    dispose(duration: number, tags) {
      //  console.log(`End span ${this.name}, action ${this.action}, id: ${this.id}; kind: ${this.kind}`);

        if (this.kind === SpanKind.Command)
            this.tracer.recordAnnotation(new Annotation.ClientRecv());
        else if (this.kind === SpanKind.Event)
            this.tracer.recordAnnotation(new Annotation.ServerSend());
        else if (this.kind === SpanKind.Task)
            this.tracer.recordAnnotation(new Annotation.ServerSend());
        else if (this.kind === SpanKind.Request)
            this.tracer.recordAnnotation(new Annotation.ServerSend());

        this.tracer = null;
    }
}
