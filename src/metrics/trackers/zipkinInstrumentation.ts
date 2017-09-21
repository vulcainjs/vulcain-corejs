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

    startSpan(id: SpanId, name: string, tags): IRequestTracker {
        return new ZipkinRequestTracker(this.recorder, id, name, tags);
    }
}

class ZipkinRequestTracker implements IRequestTracker {
    private tracer: Tracer;

    constructor(recorder, spanId: SpanId, kind: SpanKind, name: string, tags) {

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

    startCommand(command: string, target?) {
        let id;
        this.tracer.setId(this.id);
        this.tracer.scoped(() => {
            id = this.tracer.createChildId();
            this.tracer.setId(id);
            this.tracer.recordRpc(command);
            this.tracer.recordServiceName(target);
            this.tracer.recordAnnotation(new Annotation.ClientSend());
        });
        return id;
    }

    trackError(error, tags) {
        this.tracer.setId(this.id);
        this.tracer.scoped(() => {
            id && this.tracer.setId(id);
            this.tracer.recordBinary("error", error.message || error);
        });
        return id;
    }

    finishCommand(id, error) {
        this.tracer.setId(this.id);
        this.tracer.scoped(() => {
            this.tracer.setId(id);
            this.tracer.recordAnnotation(new Annotation.ClientRecv());
            if(error)
                this.tracer.recordBinary("error", error.message || error);
        });
        return id;
    }

    private readHeader(ctx: RequestContext, header: string) {
        const val = ctx.request.headers[header.toLowerCase()];
        if (val) {
            return new Some(val);
        } else {
            return None;
        }
    }

    private containsRequiredHeaders(ctx: RequestContext) {
        return ctx.request.headers[Header.TraceId.toLowerCase()] !== undefined && ctx.request.headers[Header.SpanId.toLowerCase()] !== undefined;
    }

    finish(result) {
        try {
            this.tracer.scoped(() => {
                this.tracer.setId(this.id);
                if (result.error)
                    this.tracer.recordBinary('error', result.error);
                this.tracer.recordAnnotation(new Annotation.ServerSend());
            });
        }
        catch (e) {
            // eat
        }
    }

    private stringToIntOption(str) {
        try {
            return new Some(parseInt(str));
        } catch (err) {
            return None;
        }
    }

    private stringToBoolean(str) {
        return str === '1';
    }

    injectTraceHeaders(id, headers: (name: string | any, value?: string) => any) {
        this.tracer.scoped(() => {
            this.tracer.setId(id);
            const tracer = this.tracer.id;
            headers(Header.TraceId, tracer.traceId);
            headers(Header.SpanId, tracer.spanId);

            tracer._parentId.ifPresent(psid => {
                headers(Header.ParentSpanId, psid);
            });
            tracer.sampled.ifPresent(sampled => {
                headers(Header.Sampled, sampled ? '1' : '0');
            });
        });
    }
}
