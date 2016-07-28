import {ActionData} from '../pipeline/actions';
import {ActionHandler, Action, EventHandler, Consume, Query} from '../pipeline/annotations';
import {ValidationError, RuntimeError} from '../pipeline/common';
import {Property, Model} from '../schemas/annotations'
import {Pipeline, AbstractCommand, AbstractActionHandler, QueryData, Command, AbstractQueryHandler, Domain, Schema, DefaultServiceNames, Inject, IContainer, IProvider} from '../index';

@Command({executionTimeoutInMilliseconds: 1500})
class DefaultRepositoryCommand extends AbstractCommand<any> {

    // Execute command
    async runAsync(action: string, data) {
        return this[action](data);
    }

    async create(entity: any) {
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.preCreate)
            entity = await this.schema.description.preCreate(entity, this.container) || entity;
        entity = await this.provider.createAsync(this.schema, entity);
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.preGet)
            entity = await this.schema.description.preGet(entity, this.container) || entity;
        return entity;
    }

    async update(entity: any) {
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.preUpdate)
            entity = await this.schema.description.preUpdate(entity, this.container) || entity;
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.getAsync(this.schema, entity[keyProperty]);
        if (!old)
            throw new Error("Entity doesn't exist for updating");

        entity = await this.provider.updateAsync(this.schema, entity, old);
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.preGet)
            entity = await this.schema.description.preGet(entity, this.container) || entity;
        return entity;
    }

    delete(entity: any) {
        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }

    async get(id: any) {
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        let entity = await this.provider.findOneAsync(this.schema, query);
        if (this.context.pipeline === Pipeline.Http && entity && this.schema.description.preGet)
            entity = await this.schema.description.preGet(entity, this.container) || entity;
        return entity;
    }

    async search(options: any) {
        let list = await this.provider.getAllAsync(this.schema, options);
        if (this.context.pipeline === Pipeline.Http && list && this.schema.description.preGet) {
            let result = [];
            for (const e of list) {
                let item = await this.schema.description.preGet(e, this.container);
                result.push( item || e);
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

export class DefaultQueryHandler extends AbstractQueryHandler {

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    @Query({ action: "get" })
    getAsync(id: any) {
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync("get", id);
    }

    @Query({ action: "search" })
    getAllAsync(query: any, maxByPage:number=0, page?:number) : Promise<Array<any>> {
        let options = { maxByPage: maxByPage || this.query && this.query.maxByPage || -1, page: page || this.query && this.query.page || 0, query:query };
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand", this.metadata.schema);
        return cmd.executeAsync( "search", options);
    }
}
