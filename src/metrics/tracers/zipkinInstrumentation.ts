import { System } from '../../configurations/globals/system';
import { Conventions } from '../../utils/conventions';
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IRequestTracer, IRequestTracerFactory } from './index';
import { RequestContext } from "../../pipeline/requestContext";
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
export class ZipkinInstrumentation implements IRequestTracerFactory {

    static create() {
        let zipkinAddress = DynamicConfiguration.getPropertyValue<string>("zipkinAgent");
        if (zipkinAddress) {
            if (!zipkinAddress.startsWith("http://")) {
                zipkinAddress = "http://" + zipkinAddress;
            }
            if (!/:[0-9]+/.test(zipkinAddress)) {
                zipkinAddress = zipkinAddress + ':9411';
            }
            const ctxImpl = new ExplicitContext();
            const recorder = new BatchRecorder({
                logger: new HttpLogger({
                    endpoint: `${zipkinAddress}/api/v1/spans`,
                    httpInterval: 10000
                })
            });
            return new ZipkinInstrumentation( new Tracer({ ctxImpl, recorder }));
        }
        return null;
    }

    constructor(private tracer) {
    }

    startTrace(ctx: RequestContext): IRequestTracer {
        return new ZipkinTrace(this.tracer, ctx, ctx.request.verb, ctx.requestData.params);
    }
}

class ZipkinTrace implements IRequestTracer {
    private id;

    constructor(private tracer, ctx: RequestContext, verb: string, params) {
        tracer.scoped(() => {

            if (this.containsRequiredHeaders(ctx)) {
                // Child span
                const spanId = this.readHeader(ctx, Header.SpanId);
                spanId.ifPresent(sid => {
                    const traceId = this.readHeader(ctx, Header.TraceId);
                    const parentSpanId = this.readHeader(ctx, Header.ParentSpanId);
                    const sampled = this.readHeader(ctx, Header.Sampled);
                    const flags = this.readHeader(ctx, Header.Flags).flatMap(this.stringToIntOption).getOrElse(0);
                    const id = new TraceId({
                        traceId,
                        parentId: parentSpanId,
                        spanId: sid,
                        sampled: sampled.map(this.stringToBoolean),
                        flags
                    });
                    tracer.setId(id);
                });
            } else {
                // Root span
                tracer.setId(tracer.createRootId());
                if (ctx.request.headers[Header.Flags]) {
                    const currentId = tracer.id;
                    const idWithFlags = new TraceId({
                        traceId: currentId.traceId,
                        parentId: currentId.parentId,
                        spanId: currentId.spanId,
                        sampled: currentId.sampled,
                        flags: this.readHeader(ctx, Header.Flags)
                    });
                    tracer.setId(idWithFlags);
                }
            }

            this.id = tracer.id;

            tracer.recordServiceName(System.serviceName + "-" + System.serviceVersion);
            tracer.recordRpc(verb);
            tracer.recordBinary('arguments', JSON.stringify(params));
            tracer.recordAnnotation(new Annotation.ServerRecv());
            //  tracer.recordAnnotation(new Annotation.LocalAddr({ port }));

            if (this.id.flags !== 0 && this.id.flags !== null) {
                tracer.recordBinary(Header.Flags, this.id.flags.toString());
            }
        });
    }

    traceCommand(verb: string) {
        this.tracer.recordBinary("verb", verb);
    }

    private readHeader(ctx: RequestContext, header: string) {
        const val = ctx.request.headers[header];
        if (val) {
            return new Some(val);
        } else {
            return None;
        }
    }

    private containsRequiredHeaders(ctx: RequestContext) {
        return ctx.request.headers[Header.TraceId] !== undefined && ctx.request.headers[Header.SpanId] !== undefined;
    }

    endTrace(result) {
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
}
