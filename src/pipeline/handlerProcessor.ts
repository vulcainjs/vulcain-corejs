import { VulcainMiddleware } from "./vulcainPipeline";
import { Service } from "../globals/system";
import { ActionMetadata, CommandManager } from "./handlers/actions";
import { IContainer } from "../di/resolvers";
import { UnauthorizedRequestError, ApplicationError } from "./errors/applicationRequestError";
import { HttpResponse } from "./response";
import { QueryManager } from "./handlers/query";
import { IManager } from "./handlers/common";
import { HandlerInfo, ServiceDescriptors } from "./handlers/serviceDescriptions";
import { RequestData, IRequestContext } from "./common";
import { DefaultServiceNames, Injectable, LifeTime } from '../di/annotations';
import { RequestContext } from "./requestContext";
import { Inject } from "../di/annotations";

@Injectable(LifeTime.Singleton, DefaultServiceNames.HandlerProcessor)
export class HandlerProcessor {
    private actionManager: CommandManager;
    private queryManager: QueryManager;
    private _serviceDescriptors: ServiceDescriptors;

    constructor(@Inject(DefaultServiceNames.Container) private container: IContainer) {
        this.actionManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
    }

    public async invokeHandler(ctx: IRequestContext, info: HandlerInfo, contextData?: RequestData) {
        let oldContextData = ctx.requestData;
        try {
            if (contextData) {
                ctx.requestData = contextData;
            }

            let command = ctx.requestData;
            let result: HttpResponse;
            const stubs = Service.getStubManager(ctx.container);
            let params = Object.assign({}, command.params || {});
            let metadata = <ActionMetadata>info.metadata;
            let useMockResult = false;
            result = stubs.enabled && await stubs.tryGetMockValue(ctx, metadata, info.verb, params);

            let manager: IManager;
            if (info.kind === "action") {
                manager = this.actionManager;
            }

            if (info.kind === "query") {
                manager = this.queryManager;
            }

            if (!stubs.enabled || result === undefined) {
                result = await manager.run(info, command, <RequestContext>ctx);
            }
            else {
                useMockResult = true;
            }

            (<RequestContext>ctx).response = result;
            !useMockResult && stubs.enabled && await stubs.saveStub(ctx, metadata, info.verb, params, result);
            return result;
        }
        finally {
            ctx.requestData = oldContextData;
        }
    }

    public getHandlerInfo(container: IContainer, schema: string, action: string) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo(container, schema, action);
        return info;
    }
}