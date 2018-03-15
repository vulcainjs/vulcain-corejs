import { RequestContext } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { BadRequestError } from "../errors/badRequestError";
import { Conventions } from "../../utils/conventions";
import { ApplicationError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { Service } from "../../globals/system";

/**
 * Populate requestData property with action or query context
 */
export class NormalizeDataMiddleware extends VulcainMiddleware {

    // get
    //  /api/customer.get[/id](?params)
    //  /api/customer(?params)  // action=all
    // post
    //  /api/customer.create(?params)
    // params:
    //  $action, _schema (force value)
    //  $pageSize, $page
    async invoke(ctx: RequestContext) {
        try {
            ctx.normalize();
        }
        catch (e) {
            ctx.logError(e, () => "Bad request format for " + ctx.request.url.pathname);
            ctx.response = HttpResponse.createFromError(new BadRequestError("Invalid request format"));
            return;
        }

        try {
            await super.invoke(ctx);
            if (!ctx.response) {
                ctx.response = new HttpResponse({});
            }
        }
        catch (e) {
            if (!(e instanceof ApplicationError)) {
                e = new ApplicationError(e.message, 500);
            }
            if (!(e instanceof ApplicationError) || e.statusCode !== 405) {
                // Don't pollute logs with incorect request
                ctx.logError(e, () => "Request has error");
            }
            ctx.response = HttpResponse.createFromError(e);
        }

        // Inject request context in response
        ctx.response.addHeader('Access-Control-Allow-Origin', '*'); // CORS

        if (Object.getOwnPropertyDescriptor(ctx.response.content, "value") || Object.getOwnPropertyDescriptor(ctx.response.content, "error")) {
            ctx.response.content.meta = ctx.response.content.meta || {};
            ctx.response.content.meta.correlationId = ctx.requestData.correlationId;
        }
    }
}