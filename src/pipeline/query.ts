import {HandlerFactory, CommonRequestData,CommonActionMetadata, CommonMetadata, ValidationError, RuntimeError, ErrorResponse, CommonRequestResponse, CommonHandlerMetadata, IManager} from './common';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {Application, DefaultServiceNames} from '../application';
import * as os from 'os';
import {RequestContext} from '../servers/requestContext';
import {CommandRuntimeError} from '../commands/command/command';

export interface QueryData extends CommonRequestData {
    data: any;
    maxByPage?: number;
    page?: number;
}

export interface QueryResponse<T> extends CommonRequestResponse<T> {
    maxByPage?: number;
    page?: number;
    totalPages?: number;
    total?: number;
}

export interface QueryMetadata extends CommonHandlerMetadata {
}

export interface QueryActionMetadata extends CommonActionMetadata {

}

export class QueryManager implements IManager {
    private _domain: Domain;
    private _hostname: string;
    static handlerFactory = new HandlerFactory();

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
        this._hostname = os.hostname();
    }

    private createResponse(query: QueryData, error?: ErrorResponse) {
        let res: QueryResponse<any> = {
            userContext: query.userContext,
            source: this._hostname,
            schema: query.schema,
            domain: query.domain,
            action: query.action,
            error: error,
            maxByPage: query.maxByPage,
            page: query.page
        }
        return res;
    }

    getMetadata(command: CommonRequestData) {
        let info = QueryManager.handlerFactory.getInfo<QueryMetadata>(this.container, command.domain, command.schema, command.action);
        return info.metadata;
    }

    private async validateRequestData(info, query) {
        let errors;
        let data = query.data;
        let inputSchema = info.metadata.inputSchema;
        if (inputSchema) {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                query.inputSchema = schema.name;
                errors = this.domain.validate(data, schema);
            }
            if (!errors || errors.length === 0) {
                // Custom binding if any
                if(schema)
                    data = schema.bind(data);

                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                let altMethodName = methodName + 'Async';
                errors = info.handler[methodName] && await info.handler[methodName](data);
                if (!errors)
                    errors = info.handler[altMethodName] && await info.handler[altMethodName](data);
            }
        }
        return errors;
    }

    async runAsync(query: QueryData, ctx:RequestContext) {
        let info = QueryManager.handlerFactory.getInfo<QueryActionMetadata>(this.container, query.domain, query.schema, query.action);

        try {
            let errors = await this.validateRequestData(info, query);
            if (errors && errors.length > 0)
                return this.createResponse(query, { message: "Validation errors", errors: errors });
            if (ctx.user)
                query.userContext = { id: ctx.user.id, scopes: ctx.user.scopes, displayName: ctx.user.displayName };
            query.schema = <string>info.metadata.schema;
            info.handler.requestContext = ctx;
            info.handler.query = query;
            let result = await info.handler[info.method](info.metadata.action === "get" ? query.data.id : query.data);
            let res = this.createResponse(query);
            res.value = result;
            if (Array.isArray(result))
                res.total = result.length;
            return res;
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
            return this.createResponse(query, { message: error });
        }
    }
}