import { IHttpAdapterRequest } from '../servers/abstractAdapter';
import { System } from '../configurations/globals/system';
import { IRequestTracer } from './statsdMetrics';
import { Logger } from '../servers/requestContext';
import { Conventions } from '../utils/conventions';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
const {
    Annotation,
    HttpHeaders: Header,
    option: {Some, None},
    TraceId, Tracer, ExplicitContext, ConsoleRecorder, BatchRecorder
} = require('zipkin');
const {HttpLogger} = require('zipkin-transport-http');
//const url = require('url');

export class ZipkinInstrumentation {
    private tracer;

    constructor() {
        let zipkinAddress = DynamicConfiguration.getPropertyValue<string>("zipkinAgent");
        if (zipkinAddress) {
            if (!zipkinAddress.startsWith("http://")) {
                zipkinAddress = "http://" + zipkinAddress;
            }
            const ctxImpl = new ExplicitContext();
            const recorder = new BatchRecorder({
                logger: new HttpLogger({
                    endpoint: `${zipkinAddress}:9411/api/v1/spans`,
                    httpInterval: 10000
                })
            });
            this.tracer = new Tracer({ ctxImpl, recorder });
        }
    }

    startTrace(request: IHttpAdapterRequest): IRequestTracer {
        return this.tracer && new ZipkinTrace(this.tracer, request);
    }
}

export class ZipkinTrace implements IRequestTracer {
    private id;

    constructor(private tracer, request: IHttpAdapterRequest) {
        tracer.scoped(() => {

            if (this.containsRequiredHeaders(request)) {
                // Child span
                const spanId = this.readHeader(request, Header.SpanId);
                spanId.ifPresent(sid => {
                    const traceId = this.readHeader(request, Header.TraceId);
                    const parentSpanId = this.readHeader(request, Header.ParentSpanId);
                    const sampled = this.readHeader(request, Header.Sampled);
                    const flags = this.readHeader(request, Header.Flags).flatMap(this.stringToIntOption).getOrElse(0);
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
                if (request.headers[Header.Flags]) {
                    const currentId = tracer.id;
                    const idWithFlags = new TraceId({
                        traceId: currentId.traceId,
                        parentId: currentId.parentId,
                        spanId: currentId.spanId,
                        sampled: currentId.sampled,
                        flags: this.readHeader(request, Header.Flags)
                    });
                    tracer.setId(idWithFlags);
                }
            }

            this.id = tracer.id;

            tracer.recordServiceName(System.serviceName + "-" + System.serviceVersion);
            // tracer.recordRpc(request.method);
            /*  tracer.recordBinary('http.url', url.format({
                  protocol: req.isSecure() ? 'https' : 'http',
                  host: req.header('host'),
                  pathname: req.path()
              }));*/
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

    private readHeader(request: IHttpAdapterRequest, header: string) {
        const val = request.headers[header];
        if (val) {
            return new Some(val);
        } else {
            return None;
        }
    }

    private containsRequiredHeaders(request: IHttpAdapterRequest) {
        return request.headers[Header.TraceId] !== undefined && request.headers[Header.SpanId] !== undefined;
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
