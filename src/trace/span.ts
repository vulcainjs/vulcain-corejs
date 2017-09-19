import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { System } from "../globals/system";
import { IContainer } from '../di/resolvers';
import { DefaultServiceNames } from '../di/annotations';
import { Logger } from "../log/logger";

export enum SpanKind {
    Request,
    Command
}

export class Span {
    private _logger: Logger;
    public traceId: string;
    public parentId: string;
    public spanId: string;
    public tags: { [name: string]: string } = {};
    startTick: [number, number];
    startTime: number;
    duration: number;
    private error: string;

    get now() {
        return this.startTime + this.durationInMicroseconds();
    }

    private constructor(private container: IContainer, private kind: SpanKind, traceId: string, parentId?: string) {
        this._logger = container.get<Logger>(DefaultServiceNames.Logger);

        this.startTime = Date.now() * 1000;
        this.startTick = process.hrtime();
        this.spanId = this.randomTraceId();
        this.parentId = parentId;
        this.traceId = traceId;
    }

    static createRootSpan(ctx: RequestContext) {
        return new Span(ctx.container, SpanKind.Request, ctx.correlationId, ctx.request && <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_PARENT_ID]);
    }

    static createCommandSpan(parent: Span) {
        return new Span(parent.container, SpanKind.Command, parent.traceId, parent.spanId);
    }

    injectHeaders(headers: (name: string | any, value?: string)=>any) {
        headers(VulcainHeaderNames.X_VULCAIN_PARENT_ID, this.parentId);
       // headers(Header.SpanId, tracer.spanId);
    }

    close(error?) {
        if (error)
            this.error = error.message || error;
        this.duration = this.durationInMicroseconds();
        this.container = null;
        this._logger = null;
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(ctx: RequestContext, error: Error, msg?: () => string) {
        this._logger.error(ctx, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(ctx: RequestContext, msg: () => string) {
        this._logger.info(ctx, msg);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(ctx: RequestContext, msg: () => string) {
        this._logger.verbose(ctx, msg);
    }
    
    private durationInMicroseconds() {
        const hrtime = process.hrtime(this.startTick);
        const elapsedMicros = Math.floor(hrtime[0] * 1000 + hrtime[1] / 1000000);
        return elapsedMicros;
    }

    private randomTraceId() {
        const digits = '0123456789abcdef';
        let n = '';
        for (let i = 0; i < 16; i++) {
            const rand = Math.floor(Math.random() * 16);
            n += digits[rand];
        }
        return n;
    }
}