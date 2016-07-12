
import {Application} from '../application';
import {IContainer} from '../di/resolvers';

export class RuntimeError extends Error { }

export interface ValidationError {
    id?: string;
    field?: string;
    message: string;
}

export interface ErrorResponse {
    message:string;
    errors?: Array<ValidationError>;
}

export interface CommonRequestData {
    action: string;
    domain: string;
    schema: string;
    context?: {
        id?: string;
        name?: string;
        scopes?: Array<string>;
        displayName: string;
    };
}

export interface CommonResponse {
    context: any,
    source: string;
    domain: string;
    action: string;
    schema: string;
    error?: ErrorResponse;
    value?: any;
}

export interface CommonActionMetadata {
    action?: string;
    scope?: string;
    schema?: string;
}

export interface CommonMetadata {
    schema?: string;
    serviceName?: string;
}

export interface CommonHandlerMetadata extends CommonMetadata{
    scope: string;
}

export interface IManager {
    container: IContainer;
    getMetadata(command: CommonRequestData): CommonMetadata;
    runAsync(command: CommonRequestData, ctx): Promise<CommonResponse>;
}

interface HandlerItem {
    methodName: string;
    handler;
    metadata: CommonMetadata;
}

export class HandlerFactory {
    private handlers: Map<string,HandlerItem> = new Map<string, HandlerItem>();

    register(app: Application, target: Function, actions: any, handlerMetadata: CommonMetadata) {

        let handlerKey = app.domainName.toLowerCase();

        if (handlerMetadata.schema) {
            // test if exists
            app.domain.getSchema(handlerMetadata.schema);
        }

        app.container.injectScoped(target, handlerMetadata.serviceName || target.name );

        for (let action in actions) {
            let actionMetadata: CommonActionMetadata = actions[action];
            actionMetadata = actionMetadata || <CommonActionMetadata>{};
            actionMetadata.action = actionMetadata.action || action;

            if (actionMetadata.schema) {
                // test if exists
                app.domain.getSchema(handlerMetadata.schema);
            }

            // Merge metadata
            let item: HandlerItem = {
                methodName: action,
                metadata: Object.assign({}, handlerMetadata, actionMetadata),
                handler: target
            }
            this.handlers.set(handlerKey + "." + actionMetadata.action.toLowerCase(), item);
        }
    }

    getInfo<T extends CommonMetadata>(container: IContainer, domain: string, action: string, optional?:boolean) {
        let handlerKey = domain.toLowerCase() + "." + action.toLowerCase();
        let info = this.handlers.get(handlerKey);
        if (info == null) {
            if (optional)
                return null;
            else
                throw new RuntimeError(`no handler method founded for domain ${domain}, action ${action}`);
        }

        try {
            let handler = container.resolve(info.handler);
            return { handler: handler, metadata: info.metadata, method: info.methodName };
        }
        catch (e) {
            throw new Error(`Unable to create handler for domain ${domain}, action ${action}`);
        }
    }
}
