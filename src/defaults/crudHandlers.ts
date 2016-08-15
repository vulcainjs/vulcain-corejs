import {ActionData} from '../pipeline/actions';
import {ActionHandler, Action, EventHandler, Consume, Query} from '../pipeline/annotations';
import {ValidationError, RuntimeError} from '../pipeline/common';
import {Property, Model} from '../schemas/annotations'
import {AbstractActionHandler, AbstractQueryHandler} from '../pipeline/abstractHandlers';
import {AbstractCommand, ICommand} from '../commands/command/abstractCommand'
import {Schema} from '../schemas/schema';
import {IProvider} from '../providers/provider';
import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import {Pipeline} from '../servers/requestContext';
import {Command} from '../commands/command/commandFactory';

@Command({ executionTimeoutInMilliseconds: 1500 })
export class DefaultRepositoryCommand extends AbstractCommand<any> {

    // Execute command
    async runAsync(action: string, data) {
        return this[action+ "Internal"](data);
    }

    create(entity: any) {
        return this.provider.createAsync(this.schema, entity);
    }

    protected async createInternal(entity: any) {
        if (entity && this.schema.description.preCreate)
            entity = this.schema.apply("preCreate", entity, this.container) || entity;
        if (entity && this.schema.description.sensibleData)
            entity = this.schema.apply("encrypt", entity, this.container) || entity
        entity = await this.create(entity);
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.postGet)
            entity = this.schema.apply("postGet", entity, this.container) || entity;
        if (entity && this.schema.description.sensibleData)
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
        if (entity && this.schema.description.preUpdate)
            entity = this.schema.apply("preUpdate", entity, this.container) || entity;
        if (entity && this.schema.description.sensibleData)
            entity = this.schema.apply("encrypt", entity, this.container) || entity
        entity = await this.update(entity);
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.postGet)
            entity = this.schema.apply("postGet", entity, this.container) || entity;
        if (entity && this.schema.description.sensibleData)
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
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.postGet)
            entity = this.schema.apply("postGet", entity, this.container) || entity;
        if (entity && this.schema.description.sensibleData)
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
                    if (this.context.pipeline === Pipeline.Http && this.schema.description.postGet)
                        entity = await this.schema.apply("postGet", entity, this.container) || entity;
                    if (entity && this.schema.description.sensibleData)
                        entity = await this.schema.apply("decrypt", entity, this.container) || entity;
                    result.push(entity);
                }
            }
            return result;
        }
        return list;
    }
}

export interface IDefaultActionService<T> {
    createAsync(entity: T);
    updateAsync(entity: T);
    deleteAsync(entity: T);
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

export interface IDefaultQueryService<T> {
    getAsync(id: any): Promise<T>;
    getAllAsync(query?: any, maxByPage?:number, page?: number): Promise<Array<T>>;
}

export class DefaultQueryHandler extends AbstractQueryHandler {

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    private getDefaultCommand(): ICommand {
        return this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
    }

    @Query({ action: "get" })
    getAsync(id: any) {
        let cmd = this.getDefaultCommand();
        return cmd.executeAsync("get", id);
    }

    @Query({ action: "search" })
    getAllAsync(query?: any, maxByPage:number=0, page?:number) : Promise<Array<any>> {
        let options = { maxByPage: maxByPage || this.query && this.query.maxByPage || -1, page: page || this.query && this.query.page || 0, query:query || {} };
        let cmd = this.getDefaultCommand();
        return cmd.executeAsync( "search", options);
    }
}
