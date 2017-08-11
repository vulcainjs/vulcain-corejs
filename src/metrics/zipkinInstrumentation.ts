import { IHttpAdapterRequest } from '../servers/abstractAdapter';
import { System } from '../configurations/globals/system';
import { Logger, RequestContext } from '../servers/requestContext';
import { Conventions } from '../utils/conventions';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { ActionMetadata } from '../pipeline/actions';
const {
    Annotation,
    HttpHeaders: Header,
    option: {Some, None},
    TraceId, Tracer, ExplicitContext, ConsoleRecorder, BatchRecorder
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
//const url = require('url');

/**
 * Request tracer interface
 */
export interface IRequestTracer {
    startTrace(ctx: RequestContext, verb: string, params): any;
    endTrace(tracer, result);
    traceCommand(tracer, verb: string);
}

/**
 * Needs a property named : zipkinAgent
 */
export class ZipkinInstrumentation implements IRequestTracer{
    private tracer;

    constructor() {
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
            this.tracer = new Tracer({ ctxImpl, recorder });
        }
    }

    startTrace(ctx: RequestContext, verb: string, params) {
        return this.tracer && new ZipkinTrace(this.tracer, ctx, verb, params);
    }

    traceCommand(tracer, verb: string) {
        tracer && tracer.traceCommand(verb);
    }

    endTrace(tracer, result) {
        tracer && tracer.endTrace(result);
    }
}

export class ZipkinTrace {
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
                if (ctx.headers[Header.Flags]) {
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

    setCommand(verb: string) {
        this.tracer.recordBinary("verb", verb);
    }

    private readHeader(ctx: RequestContext, header: string) {
        const val = ctx.headers[header];
        if (val) {
            return new Some(val);
        } else {
            return None;
        }
    }

    private containsRequiredHeaders(ctx: RequestContext) {
        return ctx.headers[Header.TraceId] !== undefined && ctx.headers[Header.SpanId] !== undefined;
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
