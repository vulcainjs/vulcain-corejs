import { IContainer } from '../../../di/resolvers';
import { Domain } from '../../../schemas/domain';
import { DefaultServiceNames } from '../../../di/annotations';
import { Handler } from '../descriptions/serviceDescriptions';
import { VulcainLogger } from '../../../log/vulcainLogger';
import { RequestContext } from "../../../pipeline/requestContext";
import { RequestData } from "../../../pipeline/common";
import { CommandRuntimeError } from "../../errors/commandRuntimeError";
import { HttpResponse } from "../../response";
import { BadRequestError } from "../../errors/badRequestError";
import { QueryResult } from './queryResult';
import { IManager } from '../definitions';
import { Utils } from '../utils';

export class QueryManager implements IManager {
    private _domain: Domain;

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

    private async validateRequestData(ctx: RequestContext, info: Handler, query) {
        let errors;
        let inputSchema = info.definition.inputSchema;
        if (inputSchema && inputSchema !== "none") {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                query.inputSchema = schema.name;

                // Custom binding if any
                query.params = schema.coerce(query.params);

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

    async run(info: Handler, query: RequestData, ctx: RequestContext): Promise<HttpResponse> {

        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);

        try {
            let errors = await this.validateRequestData(ctx, info, query);
            if (errors && Object.keys(errors).length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            query.schema = query.schema || <string>info.definition.schema;
            info.handler.context = ctx;

            let result = await info.handler[info.methodName](query.params);

            if (!(result instanceof HttpResponse)) {
                let values = result;
                let total = 0;
                if (result instanceof QueryResult) {
                    values = result.value;
                    total = result.totalCount;
                }

                let res:any = { meta: {}, value: Utils.obfuscateSensibleData(this.domain, this.container, values) };
                res.meta.totalCount = total;
                if (result && Array.isArray(result)) {
                    res.meta.totalCount = res.meta.totalCount || result.length;
                    res.meta.pageSize = query.pageSize;
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
