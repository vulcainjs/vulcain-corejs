import { RequestContext } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { Service } from "../../globals/system";
import { ActionMetadata, CommandManager } from "../handlers/actions";
import { IContainer } from "../../di/resolvers";
import { UnauthorizedRequestError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { QueryManager } from "../handlers/query";

export class HandlersMiddleware extends VulcainMiddleware {
    private actionManager: CommandManager;
    private queryManager: QueryManager;

    constructor(container: IContainer) {
        super();
        this.actionManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
    }

    async invoke(ctx: RequestContext) {
        let command = ctx.requestData;
        let manager = (ctx.request.verb === "GET" ? this.queryManager : this.actionManager);

        // Check if handler exists
        let info = manager.getInfoHandler(command);

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
            result = await manager.run(command, ctx);
        }
        else {
            useMockResult = true;
        }
        // TODO
        if (result && command.correlationId) {
        //    result.addHeader(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, command.correlationId);
        }

        ctx.response = result;

        !useMockResult && stubs.enabled && await stubs.saveStub(ctx, metadata, info.verb, params, result);
        return super.invoke(ctx);
    }
}