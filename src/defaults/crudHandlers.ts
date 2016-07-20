import {ActionData} from '../pipeline/actions';
import {ActionHandler, Action, EventHandler, Consume} from '../pipeline/annotations';
import {ValidationError, RuntimeError} from '../pipeline/common';
import {Property, Model} from '../schemas/annotations'
import {AbstractCommand, AbstractActionHandler, Command, AbstractQueryHandler, Domain, Schema, DefaultServiceNames, Inject, IContainer, IProvider} from '../index';

@Command({executionTimeoutInMilliseconds: 1500})
class DefaultRepositoryCommand extends AbstractCommand<any> {

    // Execute command
    async runAsync(schema: string, action: string, data) {
        this.initializeProvider(schema);
        return this[action](this.schema, data);
    }

    create(schema: Schema, entity: any) {
        return this.provider.createAsync(schema, entity);
    }

    async update(schema: Schema, entity: any) {
        let keyProperty = schema.getIdProperty();
        let old = await this.provider.getAsync(schema, entity[keyProperty]);
        if (!old)
            throw new Error("Entity doesn't exist for updating");

        let result = await this.provider.updateAsync(schema, entity, old);
        return result;
    }

    delete(schema: Schema, entity: any) {
        let keyProperty = schema.getIdProperty();
        return this.provider.deleteAsync(schema, entity[keyProperty]);
    }

    get(schema:Schema, id: any) {
        let keyProperty = schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        return this.provider.findOneAsync(schema, query);
    }

    getAllAsync(schema: Schema, options: any) {
        return this.provider.getAllAsync(schema, options);
    }
}

export class DefaultActionHandler extends AbstractActionHandler {

    constructor( @Inject("Container") protected container: IContainer) {
        super();
    }

    @Action({ action: "create" })
    createAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand");
        return cmd.executeAsync(this.metadata.schema, "create", entity);
    }

    @Action({ action: "update" })
    updateAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand");
        return cmd.executeAsync(this.metadata.schema, "update", entity);
    }

    @Action({ action: "delete" })
    deleteAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand");
        return cmd.executeAsync(this.metadata.schema, "delete", entity);
    }
}

export class DefaultQueryHandler extends AbstractQueryHandler {

    constructor( @Inject("Container") protected container: IContainer) {
        super();
    }

    @Action({ action: "get" })
    getAsync(id: any) {
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand");
        return cmd.executeAsync(this.metadata.schema, "get", id);
    }

    @Action({ action: "search" })
    getAllAsync(query: any) {
        let options = { limit: this.query.limit, page: this.query.page, query:query };
        let cmd = this.requestContext.getCommand("DefaultRepositoryCommand");
        return cmd.executeAsync(this.metadata.schema, "get", options);
    }
}