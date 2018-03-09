import { RequestContext } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { Service } from "../../globals/system";
import { IContainer } from "../../di/resolvers";
import { UnauthorizedRequestError, ApplicationError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { Handler, ServiceDescriptors } from "../handlers/descriptions/serviceDescriptions";
import { RequestData } from "../common";
import { DefaultServiceNames } from '../../di/annotations';
import { HandlerProcessor } from "../handlerProcessor";

export class HandlersMiddleware extends VulcainMiddleware {
    private handlerProcessor: HandlerProcessor;

    constructor(private container: IContainer) {
        super();
        this.handlerProcessor = this.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
    }

    async invoke(ctx: RequestContext) {
        let command = ctx.requestData;
        let info = this.handlerProcessor.getHandlerInfo(ctx.container, command.schema, command.action);

        // Check if handler exists
        if (!info)
            throw new ApplicationError(`no handler method founded for ${ctx.requestData.vulcainVerb}, path: ${ctx.request.url}`, 405);

        let guard = false;
        if (ctx.request.verb === "POST" && info.kind === "action") {
            guard = true;
        }

        if (info.kind==="query" && (ctx.request.verb === "GET" || ctx.request.verb === "POST")) {
            guard = true;
        }

        if (!guard) {
            throw new ApplicationError(`Unsupported http verb for ${ctx.requestData.vulcainVerb}, path: ${ctx.request.url}`, 405);
        }

        if (info.kind === "action" && ctx.request.verb === "GET")
            throw new ApplicationError(`Action handler ${ctx.requestData.vulcainVerb} must be called with POST`, 405);

        // Ensure schema name (casing) is valid
        ctx.requestData.schema = info.definition.schema || ctx.requestData.schema;

        ctx.logInfo(() => `Request input   : ${ctx.requestData.vulcainVerb}, params: ${JSON.stringify(command.params)}`);
        ctx.logInfo(() => `Request context : user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.user.tenant}`);

        // Process handler
        await this.handlerProcessor.invokeHandler(ctx, info);
        return super.invoke(ctx);
    }
}