import {ActionData} from '../pipeline/actions';
import {ActionHandler, Action, EventHandler, Consume, Query} from '../pipeline/annotations';
import {ValidationError, RuntimeError} from '../pipeline/common';
import {Property, Model} from '../schemas/annotations'
import {AbstractCommand, AbstractActionHandler, QueryData, Command, AbstractQueryHandler, Domain, Schema, DefaultServiceNames, Inject, IContainer, IProvider} from '../index';

@Command({executionTimeoutInMilliseconds: 1500})
class DefaultRepositoryCommand extends AbstractCommand<any> {

    // Execute command
    async runAsync(action: string, data) {
        return this[action](data);
    }

    create( entity: any) {
        return this.provider.createAsync(this.schema, entity);
    }

    async update(entity: any) {
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.getAsync(this.schema, entity[keyProperty]);
        if (!old)
            throw new Error("Entity doesn't exist for updating");

        let result = await this.provider.updateAsync(this.schema, entity, old);
        return result;
    }

    delete(entity: any) {
        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }

    get(data: any) {
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = data.id;
        return this.provider.findOneAsync(this.schema, query);
    }

    search(options: any) {
        return this.provider.getAllAsync(this.schema, options);
    }
}

export class DefaultActionHandler extends AbstractActionHandler {

    constructor( @Inject("Container") protected container: IContainer) {
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

    constructor( @Inject("Container") protected container: IContainer) {
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
