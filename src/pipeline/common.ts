
import {Application} from '../application';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';

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
    userContext?: {
        id?: string;
        name?: string;
        scopes?: Array<string>;
        displayName: string;
    };
}

export interface CommonRequestResponse {
    userContext: any,
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
    schema?: string|Function;
    serviceName?: string;
}

export interface CommonHandlerMetadata extends CommonMetadata {
    scope: string;
}

export interface IManager {
    container: IContainer;
    getMetadata(command: CommonRequestData): CommonMetadata;
    runAsync(command: CommonRequestData, ctx): Promise<CommonRequestResponse>;
}

export interface HandlerItem {
    methodName: string;
    handler;
    metadata: CommonMetadata;
}

export class HandlerFactory {
    handlers: Map<string,HandlerItem> = new Map<string, HandlerItem>();

    register(container:IContainer, domain: Domain, target: Function, actions: any, handlerMetadata: CommonMetadata) {

        let domainName = domain.name;

        if (handlerMetadata.schema) {
            // test if exists
            let tmp = domain.getSchema(handlerMetadata.schema);
            handlerMetadata.schema = tmp.name;
        }

        container.injectScoped(target, handlerMetadata.serviceName || target.name );

        for (const action in actions) {
            let actionMetadata: CommonActionMetadata = actions[action];
            actionMetadata = actionMetadata || <CommonActionMetadata>{};
            if (!actionMetadata.action) {
                let tmp = action;
                if (tmp.endsWith("Async")) tmp = tmp.substr(0, tmp.length - 5);
                actionMetadata.action = tmp;
            }

            if (actionMetadata.schema) {
                // test if exists
                let tmp = domain.getSchema(actionMetadata.schema);
                actionMetadata.schema = tmp.name;
            }

            let handlerKey = [domainName, actionMetadata.schema || handlerMetadata.schema, actionMetadata.action].join('.').toLowerCase();
            if (this.handlers.has(handlerKey))
                console.log(`Duplicate action ${actionMetadata.action} for handler ${handlerKey}`);

            // Merge metadata
            let item: HandlerItem = {
                methodName: action,
                metadata: Object.assign({}, handlerMetadata, actionMetadata),
                handler: target
            }
            this.handlers.set(handlerKey, item);
            console.log("Handler registered for domain %s metadata: %j", domainName, item.metadata);
        }
    }

    getInfo<T extends CommonMetadata>(container: IContainer, domain: string, schema: string, action: string, optional?: boolean) {
        let d = domain.toLowerCase();
        let a = action.toLowerCase();
        let handlerKey;
        let info;
        if (schema) {
            handlerKey = d + "." + schema.toLowerCase() + "." + a;
            info = this.handlers.get(handlerKey);
        }
        if (!info) {
            handlerKey = d + "." + a;
            info = this.handlers.get(handlerKey);
        }
        if (info == null) {
            if (optional)
                return null;
            else
                throw new RuntimeError(`no handler method founded for domain ${domain}, action ${action}, schema ${schema}`);
        }

        try {
            let handler = container && container.resolve(info.handler);
            return { handler: handler, metadata: <T>info.metadata, method: info.methodName };
        }
        catch (e) {
            console.log(`Unable to create handler for domain ${domain}, action ${action}, schema ${schema}`);
            console.log(e);
            throw new Error(`Unable to create handler for domain ${domain}, action ${action}, schema ${schema}`);
        }
    }
}
