import { HandlerFactory, CommonActionMetadata, ServiceHandlerMetadata, ErrorResponse, IManager } from './common';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/schema';
import * as os from 'os';
import { DefaultServiceNames } from '../../di/annotations';
import { ServiceDescriptors } from './serviceDescriptions';
import { System } from '../../globals/system';
import { VulcainLogger } from '../../log/vulcainLogger';
import { RequestContext } from "../../pipeline/requestContext";
import { RequestData } from "../../pipeline/common";
import { UserContext } from "../../security/securityManager";
import { CommandRuntimeError } from "../errors/commandRuntimeError";
import { HttpResponse } from "../response";
import { BadRequestError } from "../errors/badRequestError";
import { ApplicationRequestError } from "../errors/applicationRequestError";


export interface QueryResult {
    maxByPage?: number;
    page?: number;
    totalPages?: number;
    total?: number;
    value?;
}

/**
 *
 *
 * @export
 * @interface QueryMetadata
 * @extends {ServiceHandlerMetadata}
 */
export interface QueryMetadata extends ServiceHandlerMetadata {
}

/**
 *
 *
 * @export
 * @interface QueryActionMetadata
 * @extends {CommonActionMetadata}
 */
export interface QueryActionMetadata extends CommonActionMetadata {
    outputSchema?: string;
    outputType?: "one" | "many";
}

export class QueryManager implements IManager {
    private _domain: Domain;
    private _serviceDescriptors: ServiceDescriptors;

    /**
     * Get the current domain model
     * @returns {Domain}
     */
    get domain() {
        if (!this._domain) {
            this._domain = this.container.get<Domain>(DefaultServiceNames.Domain);
        }
        return this._domain;
    }

    constructor(public container: IContainer) {
    }

    getInfoHandler(command: RequestData, container?: IContainer) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo(container, command.schema, command.action);
        return info;
    }

    private async validateRequestData(ctx: RequestContext, info, query) {
        let errors;
        let inputSchema = info.metadata.inputSchema;
        if (inputSchema && inputSchema !== "none") {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                query.inputSchema = schema.name;

                // Custom binding if any
                query.params = schema.bind(query.params);

                errors = await schema.validateAsync(ctx, query.params);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }

            if (!errors || errors.length === 0) {
                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                let altMethodName = methodName + 'Async';
                errors = info.handler[methodName] && info.handler[methodName](query.params, query.action);
                if (!errors)
                    errors = info.handler[altMethodName] && await info.handler[altMethodName](query.params, query.action);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }
        }
        return errors;
    }

    async runAsync(query: RequestData, ctx: RequestContext): Promise<HttpResponse> {
        let info = this.getInfoHandler(query, ctx.container);
        if (info.kind !== "query")
            throw new ApplicationRequestError("Action handler must be requested with POST.", 405);

        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);

        try {
            let errors = await this.validateRequestData(ctx, info, query);
            if (errors && errors.length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            query.schema = query.schema || <string>info.metadata.schema;
            info.handler.requestContext = ctx;

            let result = await info.handler[info.method](query.params);

            if (!(result instanceof HttpResponse)) {
                let res: QueryResult = { value: HandlerFactory.obfuscateSensibleData(this.domain, this.container, result) };

                if (result && Array.isArray(result)) {
                    res.total = result.length;
                    res.maxByPage = query.maxByPage;
                    res.page = query.page;
                }
                return new HttpResponse(res);
            }
            return result;
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error : e;
            throw error;
        }
    }
}
