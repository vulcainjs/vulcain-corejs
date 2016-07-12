import {HandlerFactory, CommonRequestData, CommonMetadata, ValidationError, RuntimeError, ErrorResponse, CommonResponse, CommonHandlerMetadata, IManager} from './common';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {Application} from '../application';
import * as os from 'os';

export interface Query extends CommonRequestData {
    data: any;
    limit?: number;
    page?: number;
}

export interface QueryResponse extends CommonResponse{
    limit?: number;
    page?: number;
    totalPages?: number;
    total?: number;
}

export interface QueryMetadata extends CommonHandlerMetadata {
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
            this._domain = this.container.get("Domain");
        }
        return this._domain;
    }

    constructor(public container: IContainer) {
        this._hostname = os.hostname();
    }

    private createResponse(query: Query, error?: ErrorResponse) {
        let res: QueryResponse = {
            context: query.context,
            source: this._hostname,
            schema: query.schema,
            domain: query.domain,
            action: query.action,
            error: error,
            limit: query.limit,
            page: query.page
        }
        return res;
    }

    getMetadata(command: CommonRequestData) {
        let info = QueryManager.handlerFactory.getInfo<QueryMetadata>(this.container, command.domain, command.action);
        return info.metadata;
    }

    private async validateRequestData(info, data) {
        let errors;
        let schema = info.metadata.schema && this.domain.getSchema(info.metadata.schema);
        if (schema) {
            errors = this.domain.validate(data, schema);
        }
        if (!errors || errors.length === 0)
            errors = info.handler.validateModelAsync && await info.handler.validateModelAsync(data);
        return errors;
    }

    async runAsync(query: Query, ctx) {
        let info = QueryManager.handlerFactory.getInfo<QueryMetadata>(this.container, query.domain, query.action);

        try {
            let errors = await this.validateRequestData(info, query.data);
            if (errors && errors.length > 0)
                return this.createResponse(query, { message: "Validation errors", errors: errors });
            if (ctx.user)
                query.context = { user: ctx.user.id, scopes: ctx.user.scopes, displayName: ctx.user.displayName };
            info.handler.requestContext = ctx;
            info.handler.query = query;
            let result = await info.handler[info.method](query.data);
            let res = this.createResponse(query);
            res.value = result;
            if (Array.isArray(result))
                res.total = result.length;
            return res;
        }
        catch (e) {
            return this.createResponse(query, { message: e.message || e.toString() });
        }
    }
}