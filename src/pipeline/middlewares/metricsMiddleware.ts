import { RequestContext, VulcainHeaderNames } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { DefaultServiceNames, LifeTime } from "../../di/annotations";
import { VulcainLogger } from "../../configurations/log/vulcainLogger";
import { IRequestTracer, IRequestTracerFactory } from "../../metrics/tracers/index";
import { MetricsConstant, IMetrics } from "../../metrics/metrics";

export interface CommandMetrics {
    traceCommand: (verb: string) => void;
    now: ()=>number;
}

export interface Metrics extends CommandMetrics {
    traceId: string;
    startTick: [number, number];
    parentId: string;
    tracer: IRequestTracer;
    startTime: number;
}

export class MetricsMiddleware extends VulcainMiddleware {

    private startRequest(ctx: RequestContext) {
        const tracerFactory = ctx.container.get<IRequestTracerFactory>(DefaultServiceNames.RequestTracer, true, LifeTime.Singleton);

        let metricsInfo: Metrics = {
            traceId: this.randomTraceId(),
            startTime: Date.now() * 1000,
            startTick: process.hrtime(),
            parentId: <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_PARENT_ID],//TODO
            tracer: tracerFactory && tracerFactory.startTrace(ctx),
            traceCommand: (verb: string) => metricsInfo.tracer && metricsInfo.tracer.traceCommand(metricsInfo, verb),
            now: () => metricsInfo.startTime + this.durationInMicroseconds(metricsInfo)
        };

        ctx.metrics = metricsInfo;
        return metricsInfo;
    }

    private endRequest(logger: VulcainLogger,ctx: RequestContext, metricsInfo: Metrics, e?: Error) {
        let metrics = ctx.container.get<IMetrics>(DefaultServiceNames.Metrics);

        let hasError = false;
        let prefix: string;

        let value = ctx.response && ctx.response.content;
        hasError = !!e || !ctx.response || ctx.response.statusCode && ctx.response.statusCode >= 400 || !value;

        if (ctx.requestData.schema) {
            prefix = ctx.requestData.schema.toLowerCase() + "_" + ctx.requestData.action.toLowerCase();
        }
        else if (ctx.requestData.action) {
            prefix = ctx.requestData.action.toLowerCase();
        }

        const duration = this.durationInMicroseconds(metricsInfo);

        // Duration
        prefix && metrics.timing(prefix + MetricsConstant.duration, duration);
        metrics.timing(MetricsConstant.allRequestsDuration, duration);

        // Failure
        if (hasError) {
            prefix && metrics.increment(prefix + MetricsConstant.failure);
            metrics.increment(MetricsConstant.allRequestsFailure);
        }

        // Always remove userContext
        if (value) {
            value.userContext = undefined;
        }

        e && logger.error(ctx, e);

        metricsInfo.tracer && metricsInfo.tracer.endTrace(metricsInfo.tracer, ctx.response);
    }

    async invoke(ctx: RequestContext) {
        let metricsInfo = this.startRequest(ctx);

        let logger = ctx.container.get<VulcainLogger>(DefaultServiceNames.Logger);
        try {
            // Call next middleware
            let res = await super.invoke(ctx);
            await this.endRequest(logger, ctx, metricsInfo);
            return res;
        }
        catch (e) {
            await this.endRequest(logger, ctx, metricsInfo, e);
            throw e;
        }
    }

    /**
     * current duration in microseconds
     *
     * @static
     * @param {IContainer} [container]
     * @param {UserContext} [user]
     * @returns
    */
    private durationInMicroseconds(metrics: Metrics) {
        const hrtime = process.hrtime(metrics.startTick);
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