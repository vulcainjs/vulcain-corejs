import { System } from '../../globals/system';
import { Conventions } from '../../utils/conventions';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IRequestTracker, IRequestTrackerFactory } from './index';
import { RequestContext } from "../../pipeline/requestContext";
import { SpanId, SpanKind } from '../../trace/span';
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
        let zipkinAddress = DynamicConfiguration.getPropertyValue<string>("zipkinAgent");
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

    startSpan(id: SpanId, name: string, kind: SpanKind,  tags): IRequestTracker {
        return new ZipkinRequestTracker(this.recorder, id, kind, name, tags);
    }
}

class ZipkinRequestTracker implements IRequestTracker {
    private tracer;

    constructor(recorder, spanId: SpanId, private kind: SpanKind, name: string, tags) {

        this.tracer = new Tracer({ ctxImpl: new ExplicitContext(), recorder })

        const id = new TraceId({
            traceId: spanId.traceId,
            spanId: spanId.spanId,
            parentId: spanId.parentId,
            Sampled: None,
            Flags: 0
        });
        this.tracer.setId(id);

        this.tracer.recordServiceName(name);
        //tracer.recordRpc(verb);
        if (kind == SpanKind.Command)
            this.tracer.recordAnnotation(new Annotation.ClientSend());
        else if (kind == SpanKind.Event)
            this.tracer.recordAnnotation(new Annotation.ServerRecv());
        else if (kind == SpanKind.Task)
            this.tracer.recordAnnotation(new Annotation.ServerRecv());
        else if (kind == SpanKind.Request)
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

    dispose() {
        if (this.kind == SpanKind.Command)
            this.tracer.recordAnnotation(new Annotation.ClientSend());
        else if (this.kind == SpanKind.Event)
            this.tracer.recordAnnotation(new Annotation.ServerSend());
        else if (this.kind == SpanKind.Task)
            this.tracer.recordAnnotation(new Annotation.ServerSend());
        else if (this.kind == SpanKind.Request)
            this.tracer.recordAnnotation(new Annotation.ServerSend());

        this.tracer = null;
    }
}
