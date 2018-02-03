import { RequestContext } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { Service } from "../../globals/system";
import { ActionMetadata, CommandManager } from "../handlers/actions";
import { IContainer } from "../../di/resolvers";
import { UnauthorizedRequestError, ApplicationError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { QueryManager } from "../handlers/query";
import { IManager } from "../handlers/common";
import { HandlerInfo, ServiceDescriptors } from "../handlers/serviceDescriptions";
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
            throw new ApplicationError(`no handler method founded for ${ctx.requestData.vulcainVerb}`, 405);

        let guard = false;
        if (ctx.request.verb === "POST" && info.kind === "action") {
            guard = true;
        }

        if (info.kind==="query" && (ctx.request.verb === "GET" || ctx.request.verb === "POST")) {
            guard = true;
        }

        if (!guard)
            throw new ApplicationError(`Unsupported http verb for ${ctx.requestData.vulcainVerb}`, 405);

        if (info.kind === "action" && ctx.request.verb === "GET")
            throw new ApplicationError(`Action handler ${ctx.requestData.vulcainVerb} must be called with POST`, 405);

        // Ensure schema name (casing) is valid
        ctx.requestData.schema = info.metadata.schema || ctx.requestData.schema;

        Service.log.info(ctx, () => `Request input   : ${JSON.stringify(command.params)}`);
        Service.log.info(ctx, () => `Request context : user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.user.tenant}`);

        // Verify authorization
        if (!ctx.user.hasScope(info.metadata.scope)) {
            Service.log.error(ctx, new Error(`Unauthorized for handler ${info.verb} with scope=${info.metadata.scope}`), () => `Current user is user=${ctx.user.name}, scopes=${ctx.user.scopes}`);
            throw new UnauthorizedRequestError();
        }

        // Process handler
        await this.handlerProcessor.invokeHandler(ctx, info);
        return super.invoke(ctx);
    }
}