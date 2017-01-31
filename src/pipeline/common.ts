import {IContainer} from '../di/resolvers';
import {LifeTime} from '../di/annotations';
import {Domain} from '../schemas/schema';
import {UserContext} from '../servers/requestContext';
import { HttpResponse } from './response';


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
    correlationId: string;
    action: string;
    domain: string;
    schema: string;
    inputSchema?: string;
    userContext?: UserContext;
    params: any;
}

export interface CommonRequestResponse<T> {
    tenant: string;
    userContext: UserContext;
    domain: string;
    action: string;
    schema: string;
    error?: ErrorResponse;
    value?: T;
    inputSchema?: string;
    correlationId: string;
}

export interface CommonActionMetadata {
    description: string;
    action?: string;
    scope?: string;
    schema?: string|Function;
    inputSchema?: string | Function;
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
    enableOnTestOnly?: boolean;
}

export interface IManager {
    container: IContainer;
    getInfoHandler<T>(command: CommonRequestData, container?: IContainer): { verb: string, handler: Function, metadata: T, method: string, kind: "query" | "action" | "event" };
    runAsync(command: CommonRequestData, ctx): Promise<HttpResponse>;
}

export class HandlerFactory {

    static obfuscateSensibleData(domain: Domain, container: IContainer, result) {
        if (result) {
            if (Array.isArray(result)) {
                let outputSchema;
                result.forEach(v => {
                    if (v.__schema) {
                        if (!outputSchema || outputSchema.name !== v.__schema)
                            outputSchema = domain.getSchema(v.__schema);
                        if (outputSchema && outputSchema.description.hasSensibleData)
                            domain.obfuscate(v, outputSchema);
                    }
                });
            }
            else if (result.__schema) {
                let outputSchema = domain.getSchema(result.__schema);
                if (outputSchema && outputSchema.description.hasSensibleData)
                    domain.obfuscate(result, outputSchema);
            }
        }

        return result;
    }
}
