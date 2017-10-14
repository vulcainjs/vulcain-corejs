import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import { AbstractProviderCommand } from "../commands/abstractProviderCommand";
import { AbstractActionHandler, AbstractQueryHandler } from "../pipeline/handlers/abstractHandlers";
import { Action, Query } from "../pipeline/handlers/annotations";
import { ICommand } from "../commands/abstractCommand";
import { Command } from "../commands/commandFactory";
import { ApplicationError } from './../pipeline/errors/applicationRequestError';

@Command({ executionTimeoutInMilliseconds: 5000 })
export class DefaultCRUDCommand extends AbstractProviderCommand<any> {
    createAsync(entity: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.trackAction("create");
        return this.provider.createAsync( this.schema, entity);
    }

    async createWithSensibleDataAsync(entity: any) {
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.createAsync(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    async updateAsync(entity: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.trackAction("update");
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.getAsync(this.schema, entity[keyProperty]);
        if (!old)
            throw new ApplicationError("Entity doesn't exist for updating : " + entity[keyProperty]);
        return await this.provider.updateAsync(this.schema, entity, old);
    }

    async updateWithSensibleDataAsync(entity: any) {
        // TODO move to provider
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.updateAsync(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    deleteWithSensibleDataAsync(entity: any) {
        return this.deleteAsync(entity);
    }

    deleteAsync(entity: any) {
        this.context.trackAction("delete");
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }

    async getAsync(id: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.trackAction("get");
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        return await this.provider.findOneAsync(this.schema, query);
    }

    async getWithSensibleDataAsync(id: any) {
        let entity = await this.getAsync(id);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    getAllAsync(options: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.trackAction("getAll");
        return this.provider.getAllAsync(this.schema, options);
    }

    async getAllWithSensibleDataAsync(options: any) {
        let list = await this.getAllAsync(options);
        if (list && list.length > 0 && this.schema.description.hasSensibleData) {
            let result = [];
            for (let entity of list) {
                if (entity) {
                    entity = this.schema.decrypt(entity) || entity;
                    result.push(entity);
                }
            }
            return result;
        }
        return list;
    }
}

export class DefaultActionHandler extends AbstractActionHandler {

    constructor( @Inject("Container") container: IContainer) {
        super(container);
    }

    @Action({ action: "create", description: "Create a new entity" , outputSchema:""})
    async createAsync(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.context.getDefaultCRUDCommand(this.metadata.schema);
        return cmd.createWithSensibleDataAsync(entity);
    }

    @Action({ action: "update", description: "Update an entity", outputSchema:"" }) // Put outputSchema empty to take the default schema
    async updateAsync(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.context.getDefaultCRUDCommand(this.metadata.schema);
        return cmd.updateWithSensibleDataAsync( entity);
    }

    @Action({ action: "delete", description: "Delete an entity", outputSchema:"boolean" })
    async deleteAsync(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");

        let cmd = this.context.getDefaultCRUDCommand(this.metadata.schema);
        return cmd.deleteWithSensibleDataAsync( entity);
    }
}

export class DefaultQueryHandler<T> extends AbstractQueryHandler {

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    @Query({ action: "get", description: "Get an entity by id" })
    async getAsync(id: any): Promise<T> {
        let cmd = this.context.getDefaultCRUDCommand(this.metadata.schema);
        return await cmd.getWithSensibleDataAsync(id);
    }

    @Query({ action: "all", description: "Get all entities" })
    async getAllAsync(query?: any) : Promise<Array<T>> {
        let options = {
            maxByPage: this.context.requestData.maxByPage || 0,
            page: this.context.requestData.page || 0,
            query: query || {}
        };
        let cmd = this.context.getDefaultCRUDCommand(this.metadata.schema);
        return await cmd.getAllWithSensibleDataAsync(options);
    }
}
