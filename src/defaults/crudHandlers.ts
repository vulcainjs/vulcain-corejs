import { Action, Query} from '../pipeline/annotations';
import {AbstractActionHandler, AbstractQueryHandler} from '../pipeline/abstractHandlers';
import {ICommand} from '../commands/command/abstractCommand';
import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import {Command} from '../commands/command/commandFactory';
import { AbstractProviderCommand } from '../commands/command/abstractProviderCommand';

@Command({ executionTimeoutInMilliseconds: 5000 })
export class DefaultRepositoryCommand extends AbstractProviderCommand<any> {

    initializeMetricsInfo() {
        // do nothing
        // since this command is generic, settings are made on every request
    }

    // Execute command
    runAsync(action: string, data) {
        this.setMetricsTags(this.provider.address, this.schema.name, this.requestContext.tenant);
        return this[action + "Internal"](data);
    }

    create(entity: any) {
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
        return this.delete(entity);
    }

    delete(entity: any) {
        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }

    async get(id: any) {
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
        return this.provider.getAllAsync(this.schema, options);
    }

    protected async allInternal(options: any) {
        let list = await this.all(options);
        if (list) {
            let result = [];
            for (let entity of list) {
                if (entity) {
                    if (entity && this.schema.description.hasSensibleData)
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
        return cmd.executeAsync( "create", entity);
    }

    @Action({ action: "update", description: "Update an entity", outputSchema:"" }) // Put outputSchema empty to take the default schema
    async updateAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = await this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "update", entity);
    }

    @Action({ action: "delete", description: "Delete an entity", outputSchema:"boolean" })
    async deleteAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let cmd = await this.requestContext.getCommandAsync("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "delete", entity);
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
        return <Promise<T>>cmd.executeAsync("get", id);
    }

    @Query({ action: "all", description: "Get all entities" })
    async getAllAsync(query?: any, maxByPage:number=0, page?:number) : Promise<Array<T>> {
        let options = { maxByPage: maxByPage || this.query && this.query.maxByPage || 0, page: page || this.query && this.query.page || 0, query:query || {} };
        let cmd = await this.getDefaultCommandAsync();
        return <Promise<Array<T>>>cmd.executeAsync( "all", options);
    }
}
