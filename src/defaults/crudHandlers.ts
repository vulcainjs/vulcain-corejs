import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import { AbstractProviderCommand } from "../commands/abstractProviderCommand";
import { AbstractActionHandler, AbstractQueryHandler } from "../pipeline/handlers/abstractHandlers";
import { Action, Query } from "../pipeline/handlers/annotations";
import { ICommand } from "../commands/abstractCommand";
import { Command } from "../commands/commandFactory";

@Command({ executionTimeoutInMilliseconds: 5000 })
export class DefaultRepositoryCommand extends AbstractProviderCommand<any> {

    // Execute command
    runAsync(action: string, data) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.requestContext && this.requestContext.security.tenant);
        return this[action + "Internal"](data);
    }

    create(entity: any) {
        this.tracer.setAction("create");
        return this.provider.createAsync(this.schema, entity);
    }

    protected async createInternal(entity: any) {
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.create(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    async update(entity: any) {
        this.tracer.setAction("update");
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.getAsync(this.schema, entity[keyProperty]);
        if (!old)
            throw new Error("Entity doesn't exist for updating : " + entity[keyProperty]);
        return await this.provider.updateAsync(this.schema, entity, old);
    }

    protected async updateInternal(entity: any) {
        // TODO move to provider
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.update(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    protected deleteInternal(entity: any) {
        this.tracer.setAction("delete");
        return this.delete(entity);
    }

    delete(entity: any) {
        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }

    async get(id: any) {
        this.tracer.setAction("get");
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        return await this.provider.findOneAsync(this.schema, query);
    }

    protected async getInternal(id: any) {
        let entity = await this.get(id);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    all(options: any) {
        this.tracer.setAction("getAll");
        return this.provider.getAllAsync(this.schema, options);
    }

    protected async allInternal(options: any) {
        let list = await this.all(options);
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
            throw new Error("Entity is required");
        let cmd = await this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.runAsync( "create", entity);
    }

    @Action({ action: "update", description: "Update an entity", outputSchema:"" }) // Put outputSchema empty to take the default schema
    async updateAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = await this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.runAsync( "update", entity);
    }

    @Action({ action: "delete", description: "Delete an entity", outputSchema:"boolean" })
    async deleteAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let cmd = await this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.runAsync( "delete", entity);
    }
}

export class DefaultQueryHandler<T> extends AbstractQueryHandler {

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    private getDefaultCommandAsync(): Promise<ICommand> {
        return this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
    }

    @Query({ action: "get", description: "Get an entity by id" })
    async getAsync(id: any) {
        let cmd = await this.getDefaultCommandAsync();
        return <Promise<T>>cmd.runAsync("get", id);
    }

    @Query({ action: "all", description: "Get all entities" })
    async getAllAsync(query?: any, maxByPage:number=0, page?:number) : Promise<Array<T>> {
        let options = { maxByPage: maxByPage || this.requestContext.requestData.maxByPage || 0, page: page || this.requestContext.requestData.page || 0, query:query || {} };
        let cmd = await this.getDefaultCommandAsync();
        return <Promise<Array<T>>>cmd.runAsync( "all", options);
    }
}
