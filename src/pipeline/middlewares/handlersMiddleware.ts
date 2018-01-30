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

export class HandlersMiddleware extends VulcainMiddleware {
    private actionManager: CommandManager;
    private queryManager: QueryManager;
    private _serviceDescriptors: ServiceDescriptors;

    constructor(private container: IContainer) {
        super();
        this.actionManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
    }

    async invoke(ctx: RequestContext) {
        let command = ctx.requestData;
        let manager: IManager;
        let info = this.getInfoHandler(command, ctx.container);

        // Check if handler exists
        if (!info)
            throw new ApplicationError(`no handler method founded for ${ctx.requestData.vulcainVerb}`, 405);

        if (ctx.request.verb === "POST" && info.kind === "action") {
            manager = this.actionManager;
        }

        if (info.kind==="query" && (ctx.request.verb === "GET" || ctx.request.verb === "POST")) {
            manager = this.queryManager;
        }

        if (!manager)
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
        let result: HttpResponse;
        const stubs = Service.getStubManager(ctx.container);
        let params = Object.assign({}, command.params || {});
        let metadata = <ActionMetadata>info.metadata;
        let useMockResult = false;
        result = stubs.enabled && await stubs.tryGetMockValue(ctx, metadata, info.verb, params);

        if (!stubs.enabled || result === undefined) {
            result = await manager.run(info, command, ctx);
        }
        else {
            useMockResult = true;
        }

        ctx.response = result;

        !useMockResult && stubs.enabled && await stubs.saveStub(ctx, metadata, info.verb, params, result);
        return super.invoke(ctx);
    }


    private getInfoHandler(command: RequestData, container?: IContainer) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo(container, command.schema, command.action);
        return info;
    }
}