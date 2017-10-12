import {IContainer} from '../../di/resolvers';
import {LifeTime} from '../../di/annotations';
import {Domain} from '../../schemas/schema';
import { UserContext } from "../../security/securityContext";
import { RequestData } from "../../pipeline/common";
import { ValidationError } from "../../pipeline/errors/validationError";
import { HttpResponse } from "../response";

export interface ErrorResponse {
    message:string;
    errors?: Array<ValidationError>;
}

export interface CommonActionMetadata {
    description: string;
    action?: string;
    scope?: string;
    schema?: string;
    inputSchema?: string;
}

export interface CommonMetadata {
    description?: string;
    schema?: string;
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
    getInfoHandler(command: RequestData, container?: IContainer): { verb: string, handler: Function, metadata: CommonActionMetadata, method: string, kind: "query" | "action" | "event" };
    runAsync(command: RequestData, ctx): Promise<HttpResponse>;
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
