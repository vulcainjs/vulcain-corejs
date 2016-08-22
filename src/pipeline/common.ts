
import {Application} from '../application';
import {IContainer} from '../di/resolvers';
import {LifeTime} from '../di/annotations';
import {Domain} from '../schemas/schema';
import {UserContext} from '../servers/requestContext';

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
    inputSchema?: string;
    userContext?: UserContext
}

export interface CommonRequestResponse<T> {
    userContext: any,
    source: string;
    domain: string;
    action: string;
    schema: string;
    error?: ErrorResponse;
    value?: T;
    inputSchema?: string;
}

export interface CommonActionMetadata {
    description?: string;
    action?: string;
    scope?: string;
    schema?: string|Function;
    inputSchema?: string | Function;
    outputSchema?: string;
}

export interface CommonMetadata {
    description?: string;
    schema?: string|Function;
}

export interface CommonHandlerMetadata extends CommonMetadata {
    scope: string;
}

export interface ServiceHandlerMetadata extends CommonHandlerMetadata {
    serviceName?: string;
    serviceLifeTime?: LifeTime;
}

export interface IManager {
    container: IContainer;
    getMetadata(command: CommonRequestData): CommonMetadata;
    runAsync(command: CommonRequestData, ctx): Promise<CommonRequestResponse<any>>;
}

export interface HandlerItem {
    methodName: string;
    handler;
    metadata: CommonActionMetadata;
}

export class HandlerFactory {
    handlers: Map<string, HandlerItem> = new Map<string, HandlerItem>();
    private isMonoSchema: boolean = undefined;

    private ensuresOptimized(domain) {
        if (!domain || this.isMonoSchema !== undefined)
            return;

        // Check if all schema are the same so schema will be optional on request
        this.isMonoSchema = true;
        let schema;
        for (const item of this.handlers.values()) {
            if (!item.metadata.schema)
                continue;
            if (!schema)
                schema = item.metadata.schema;
            else if (item.metadata.schema !== schema) {
                this.isMonoSchema = false;
                break;
            }
        }

        if (this.isMonoSchema) {
            let handlers = new Map<string, HandlerItem>();
            // Normalize all keys
            for (const item of this.handlers.values()) {
                let handlerKey = [domain, item.metadata.action].join('.').toLowerCase();
                if (handlers.has(handlerKey))
                    console.log(`Duplicate action ${item.metadata.action} for handler ${handlerKey}`);
                handlers.set(handlerKey, item);
            }
            this.handlers = handlers;
        }
    }

    register(container: IContainer, domain: Domain, target: Function, actions: any, handlerMetadata: ServiceHandlerMetadata, useSchemaByDefault = false) {

        let domainName = domain.name;
        handlerMetadata = handlerMetadata || {scope:"*"};

        if (handlerMetadata.schema) {
            // test if exists
            let tmp = domain.getSchema(handlerMetadata.schema);
            handlerMetadata.schema = tmp.name;
        }

        container.inject(handlerMetadata.serviceName || target.name, target, handlerMetadata.serviceLifeTime || LifeTime.Scoped);

        for (const action in actions) {
            let actionMetadata: CommonActionMetadata = actions[action];
            actionMetadata = actionMetadata || <CommonActionMetadata>{};
            actionMetadata.action = actionMetadata.action || action;

            if (!actionMetadata.inputSchema && useSchemaByDefault) {
                actionMetadata.inputSchema = actionMetadata.schema || handlerMetadata.schema;
            }
            if (!actionMetadata.outputSchema) {
                actionMetadata.outputSchema = <string>actionMetadata.inputSchema;
            }
            if (actionMetadata.schema) {
                // test if exists
                let tmp = domain.getSchema(actionMetadata.schema);
                actionMetadata.schema = tmp.name;
            }
            if (actionMetadata.inputSchema) {
                // test if exists
                let tmp = domain.getSchema(actionMetadata.inputSchema);
                actionMetadata.inputSchema = tmp.name;
            }

            let keys = [domainName];
            let schema = <string>actionMetadata.schema || <string>handlerMetadata.schema;
            if (schema)
                keys.push(schema);
            keys.push(actionMetadata.action);
            let handlerKey = keys.join('.').toLowerCase();
            if (this.handlers.has(handlerKey))
                console.log(`*** Duplicate action ${actionMetadata.action} for handler ${target.name}`);

            // Merge metadata
            let item: HandlerItem = {
                methodName: action,
                metadata: Object.assign({}, handlerMetadata, actionMetadata),
                handler: target
            }
            this.handlers.set(handlerKey, item);
            console.log("Handler registered for domain %s with key %s metadata: %j", domainName, handlerKey, item.metadata);
        }
    }

    getInfo<T extends CommonMetadata>(container: IContainer, domain: string, schema: string, action: string, optional?: boolean) {

        this.ensuresOptimized(domain);

        let d = domain && domain.toLowerCase();
        let a = action && action.toLowerCase();
        let handlerKey;
        let info;
        if (!this.isMonoSchema && schema) {
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

    static obfuscateSensibleData(domain: Domain, container: IContainer, result) {
        if (result) {
            if (Array.isArray(result)) {
                let outputSchema;
                result.forEach(v => {
                    if (v.__schema) {
                        if (!outputSchema || outputSchema.name !== v.__schema)
                            outputSchema = domain.getSchema(v.__schema);
                        if (outputSchema && outputSchema.description.onHttpResponse)
                            domain.applyMethod("onHttpResponse", outputSchema, [v, container]);
                    }
                });
            }
            else if (result.__schema) {
                let outputSchema = domain.getSchema(result.__schema);
                if (outputSchema && outputSchema.description.onHttpResponse)
                    domain.applyMethod("onHttpResponse", outputSchema, [result, container]);
            }
        }

        return result;
    }
}
