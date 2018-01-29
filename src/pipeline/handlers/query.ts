import { HandlerFactory, CommonActionMetadata, ServiceHandlerMetadata, IManager } from './common';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/domain';
import { DefaultServiceNames } from '../../di/annotations';
import { ServiceDescriptors } from './serviceDescriptions';
import { VulcainLogger } from '../../log/vulcainLogger';
import { RequestContext } from "../../pipeline/requestContext";
import { RequestData } from "../../pipeline/common";
import { CommandRuntimeError } from "../errors/commandRuntimeError";
import { HttpResponse } from "../response";
import { BadRequestError } from "../errors/badRequestError";
import { ApplicationError } from "../errors/applicationRequestError";


export class QueryResult<T=any> {
    constructor(public value: Array<T>, public total?: number) { }
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

                errors = await schema.validate(ctx, query.params);
            }

            if (!errors) {
                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                errors = info.handler[methodName] && await info.handler[methodName](query.params, query.action);
            }
        }
        return errors;
    }

    async run(query: RequestData, ctx: RequestContext): Promise<HttpResponse> {
        let info = this.getInfoHandler(query, ctx.container);
        if (info.kind !== "query")
            throw new ApplicationError("Action handler must be requested with POST.", 405);

        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);

        try {
            let errors = await this.validateRequestData(ctx, info, query);
            if (errors && Object.keys(errors).length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            query.schema = query.schema || <string>info.metadata.schema;
            info.handler.context = ctx;

            let result = await info.handler[info.method](query.params);

            if (!(result instanceof HttpResponse)) {
                let values = result;
                let total = 0;
                if (result instanceof QueryResult) {
                    values = result.value;
                    total = result.total;
                }

                let res:any = { meta: {}, value: HandlerFactory.obfuscateSensibleData(this.domain, this.container, values) };
                res.meta.total = total;
                if (result && Array.isArray(result)) {
                    res.meta.total = res.meta.total || result.length;
                    res.meta.maxByPage = query.maxByPage;
                    res.meta.page = query.page;
                }
                return new HttpResponse(res);
            }
            return result;
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError && e.error) ? e.error : e;
            throw error;
        }
    }
}
