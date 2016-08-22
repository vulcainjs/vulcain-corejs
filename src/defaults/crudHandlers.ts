import { Action, Query} from '../pipeline/annotations';
import {AbstractActionHandler, AbstractQueryHandler} from '../pipeline/abstractHandlers';
import {AbstractCommand, ICommand} from '../commands/command/abstractCommand'
import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import {Command} from '../commands/command/commandFactory';

@Command({ executionTimeoutInMilliseconds: 5000 })
export class DefaultRepositoryCommand extends AbstractCommand<any> {

    // Execute command
    async runAsync(action: string, data) {
        return this[action + "Internal"](data);
    }

    create(entity: any) {
        return this.provider.createAsync(this.schema, entity);
    }

    protected async createInternal(entity: any) {
        if (entity && this.schema.description.encryptData)
            entity = this.schema.apply("encrypt", entity, this.container) || entity
        entity = await this.create(entity);
        if (entity && this.schema.description.encryptData)
            entity = this.schema.apply("decrypt", entity, this.container) || entity;
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
        if (entity && this.schema.description.encryptData)
            entity = this.schema.apply("encrypt", entity, this.container) || entity
        entity = await this.update(entity);
        if (entity && this.schema.description.encryptData)
            entity = this.schema.apply("decrypt", entity, this.container) || entity;
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
        if (entity && this.schema.description.encryptData)
            entity = this.schema.apply("decrypt", entity, this.container) || entity;
        return entity;
    }

    search(options: any) {
        return this.provider.getAllAsync(this.schema, options);
    }

    protected async searchInternal(options: any) {
        let list = await this.search(options);
        if (list) {
            let result = [];
            for (let entity of list) {
                if (entity) {
                    if (entity && this.schema.description.encryptData)
                        entity = this.schema.apply("decrypt", entity, this.container) || entity;
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

    @Action({ action: "create" })
    createAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "create", entity);
    }

    @Action({ action: "update" })
    updateAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "update", entity);
    }

    @Action({ action: "delete" })
    deleteAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "delete", entity);
    }
}

export class DefaultQueryHandler<T> extends AbstractQueryHandler {

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    private getDefaultCommand(): ICommand {
        return this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
    }

    @Query({ action: "get" })
    getAsync(id: any) {
        let cmd = this.getDefaultCommand();
        return <Promise<T>>cmd.executeAsync("get", id);
    }

    @Query({ action: "search" })
    getAllAsync(query?: any, maxByPage:number=0, page?:number) : Promise<Array<T>> {
        let options = { maxByPage: maxByPage || this.query && this.query.maxByPage || -1, page: page || this.query && this.query.page || 0, query:query || {} };
        let cmd = this.getDefaultCommand();
        return <Promise<Array<T>>>cmd.executeAsync( "search", options);
    }
}
