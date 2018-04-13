import { DefaultServiceNames, Inject } from '../di/annotations';
import { IContainer } from "../di/resolvers";
import { Service } from "../globals/system";
import { IRequestContext, RequestData } from "./common";
import { UnauthorizedRequestError } from "./errors/applicationRequestError";
import { CommandManager } from "./handlers/action/actionManager";
import { ActionDefinition } from "./handlers/action/definitions";
import { IManager } from "./handlers/definitions";
import { Handler, ServiceDescriptors } from "./handlers/descriptions/serviceDescriptions";
import { QueryManager } from "./handlers/query/queryManager";
import { ContextWrapper, RequestContext } from "./requestContext";
import { HttpResponse } from "./response";

export class HandlerProcessor {
    private actionManager: CommandManager;
    private queryManager: QueryManager;
    private _serviceDescriptors: ServiceDescriptors;

    constructor(@Inject(DefaultServiceNames.Container) private container: IContainer) {
        this.actionManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
    }

    public async invokeHandler(context: IRequestContext, info: Handler, contextData?: RequestData) {
        // Verify authorization
        if (!context.user.hasScope(info.definition.scope)) {
            context.logError(new Error(`Unauthorized for handler ${info.verb} with scope=${info.definition.scope}`), () => `Current user is user=${ctx.user.name}, scopes=${ctx.user.scopes}`);
            throw new UnauthorizedRequestError();
        }

        let ctx = contextData ? new ContextWrapper(context, contextData) : context;

        let command = ctx.requestData;
        let result: HttpResponse;
        const stubs = Service.getStubManager(ctx.container);
        let params = Object.assign({}, command.params || {});
        let metadata = <ActionDefinition>info.definition;

        result = stubs.enabled && await stubs.tryGetMockValue(ctx, metadata, info.verb, params);
        if (!stubs.enabled || result === undefined) {
            let manager: IManager;
            if (info.kind === "action") {
                manager = this.actionManager;
            }
    
            if (info.kind === "query") {
                manager = this.queryManager;
            }
            result = await manager.run(info, command, <RequestContext>ctx);
            (<RequestContext>ctx).response = result;
        }
        else {
            (<RequestContext>ctx).response = result;
            stubs.enabled && await stubs.saveStub(ctx, metadata, info.verb, params, result);
        }

        return result;
    }

    public getHandlerInfo(container: IContainer, schema: string, action: string) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo(container, schema, action);
        return info;
    }
}