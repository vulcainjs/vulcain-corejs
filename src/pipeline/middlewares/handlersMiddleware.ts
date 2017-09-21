import { RequestContext, VulcainHeaderNames } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { System } from "../../globals/system";
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

        System.log.info(ctx, () => `Request input   : ${JSON.stringify(command.params)}`);
        System.log.info(ctx, () => `Request context : user=${ctx.security.name}, scopes=${ctx.security.scopes}, tenant=${ctx.security.tenant}`);

        // Verify authorization
        if (!ctx.security.userHasScope(info.metadata.scope)) {
            System.log.error(ctx, new Error(`Unauthorized for handler ${info.verb} with scope=${info.metadata.scope}`), () => `Current user is user=${ctx.security.name}, scopes=${ctx.security.scopes}`);
            throw new UnauthorizedRequestError();
        }

        // Process handler
        let result: HttpResponse;
        const mocks = System.getMocksManager(ctx.container);
        let params = Object.assign({}, command.params || {});
        let metadata = <ActionMetadata>info.metadata;
        result = mocks.enabled && await mocks.tryGetMockValueAsync(ctx, metadata, info.verb, params);

        if (!mocks.enabled || result === undefined) {
            result = await manager.runAsync(command, ctx);
        }
        // TODO
        if (result && command.correlationId) {
            result.addHeader(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, command.correlationId);
        }

        ctx.response = result;

        //this.endRequest(result, ctx);
        mocks.enabled && await mocks.saveMockValueAsync(ctx, metadata, info.verb, params, result);
        return super.invoke(ctx);
    }
}