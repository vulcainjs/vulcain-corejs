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
    private error: Error;

    get now() {
        return this.startTime + this.durationInMicroseconds();
    }

    private constructor(private context: RequestContext, private kind: SpanKind, private name: string, traceId: string, parentId?: string) {
        this._logger = context.container.get<Logger>(DefaultServiceNames.Logger);

        this.startTime = Date.now() * 1000;
        this.startTick = process.hrtime();
        this.spanId = this.randomTraceId();
        this.parentId = parentId;
        this.traceId = traceId;
    }

    static createRootSpan(ctx: RequestContext) {
        return new Span(ctx, SpanKind.Request, System.fullServiceName, ctx.correlationId, ctx.request && <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_PARENT_ID]);
    }

    createCommandSpan(commandName: string) {
        return new Span(this.context, SpanKind.Command, commandName,  this.traceId, this.spanId);
    }

    injectHeaders(headers: (name: string | any, value?: string)=>any) {
        headers(VulcainHeaderNames.X_VULCAIN_PARENT_ID, this.parentId);
       // headers(Header.SpanId, tracer.spanId);
    }

    close() {
        this.duration = this.durationInMicroseconds();
        this.context = null;
        this._logger = null;
    }

    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: () => string) {
        if (!this.error) this.error = error; // Catch first error
        this._logger.error(this.context, error, msg);
    }

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: () => string) {
        this._logger.info(this.context, msg);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: () => string) {
        this._logger.verbose(this.context, msg);
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