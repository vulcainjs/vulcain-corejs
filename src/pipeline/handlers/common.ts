import {IContainer} from '../../di/resolvers';
import {LifeTime} from '../../di/annotations';
import {Domain} from '../../schemas/schema';
import { RequestData } from "../../pipeline/common";
import { HttpResponse } from "../response";
import { RequestContext } from '../requestContext';
import { Schema } from '../../index';

export interface ErrorResponse {
    message: string;
    errors?: { [propertyName: string]: string };
}

export interface CommonActionMetadata {
    description: string;
    action?: string;
    scope?: string;
    schema?: string;
    inputSchema?: string;
    outputSchema?: string;
    outputType?: "one" | "many";
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
    run(command: RequestData, ctx: RequestContext): Promise<HttpResponse>;
}

export class HandlerFactory {

    static obfuscateSensibleData(domain: Domain, container: IContainer, result?:any) {
        if (result) {
            if (Array.isArray(result)) {
                let outputSchema:Schema|null;
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
