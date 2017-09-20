import { RequestContext, VulcainHeaderNames } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { DefaultServiceNames, LifeTime } from "../../di/annotations";
import { VulcainLogger } from "../../log/vulcainLogger";
import { IRequestTracker, IRequestTrackerFactory } from "../../metrics/trackers/index";
import { MetricsConstant, IMetrics } from "../../metrics/metrics";
import { Span } from "../../trace/span";

export class MetricsMiddleware extends VulcainMiddleware {

    async invoke(ctx: RequestContext) {
        let span = Span.createRootSpan(ctx);
        try {
            // Call next middleware
            let res = await super.invoke(ctx);
            return res;
        }
        finally {
            span.close();
        }
    }
}