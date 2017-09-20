import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { System } from "../globals/system";
import { IContainer } from '../di/resolvers';
import { DefaultServiceNames } from '../di/annotations';
import { Logger } from "../log/logger";
import { MetricsConstant, IMetrics } from "./../metrics/metrics";

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
    private error: Error;

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
        if (this.kind === SpanKind.Request)
            this.endRequest();
        else
            this.endCommand();
        this.context = null;
        this._logger = null;
    }

    endCommand()
    {
        this.metrics.timing(AbstractHttpCommand.METRICS_NAME + MetricsConstant.duration, duration, this.customTags);
        if (error)
            this.metrics.increment(AbstractHttpCommand.METRICS_NAME + MetricsConstant.failure, this.customTags);

        // End Command trace
        this._logger && this._logger.logAction(this.context, "EC", "Http", `Command: ${Object.getPrototypeOf(this).constructor.name} completed with ${error ? 'success' : 'error'}`);
    }

    private endRequest() {
        let metrics = this.context.container.get<IMetrics>(DefaultServiceNames.Metrics);

        let hasError = false;
        let prefix: string;

        let value = this.context.response && this.context.response.content;
        hasError = !!this.error || !this.context.response || this.context.response.statusCode && this.context.response.statusCode >= 400;// || !value;

        if (this.context.requestData.schema) {
            prefix = this.context.requestData.schema.toLowerCase() + "_" + this.context.requestData.action.toLowerCase();
        }
        else if (this.context.requestData.action) {
            prefix = this.context.requestData.action.toLowerCase();
        }

        const duration = this.durationInMicroseconds;

        // Duration
        prefix && metrics.timing(prefix + MetricsConstant.duration, duration);
        metrics.timing(MetricsConstant.allRequestsDuration, duration);

        // Failure
        if (hasError) {
            prefix && metrics.increment(prefix + MetricsConstant.failure);
            metrics.increment(MetricsConstant.allRequestsFailure);
        }

        // Always remove userContext
        if (typeof (value) === "object") {
            value.userContext = undefined;
        }

        //        metricsInfo.tracer && metricsInfo.tracer.finish(this.context.response);
    }

    setAction(name: string) {
        this.name = this.name + "." + name;
    }

    addTag(name: string, value: string) {
        this.tags[name] = value;
    }

    addTags(tags) {
        this.tags[name] = Object.assign(this.tags[name] || {}, tags);
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

    get now() {
        return this.startTime + this.durationInMicroseconds;
    }

    get durationInMs() {
        return this.durationInMicroseconds / 1000;
    }

    private get durationInMicroseconds() {
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