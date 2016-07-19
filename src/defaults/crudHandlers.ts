import {CommandData} from '../pipeline/commands';
import {CommandHandler, Action, EventHandler, Consume} from '../pipeline/annotations';
import {ValidationError, RuntimeError} from '../pipeline/common';
import {Property, Model} from '../schemas/annotations'
import {AbstractCommandHandler, AbstractQueryHandler, Domain, Schema, DefaultServiceNames, Inject, IContainer, IProvider} from '../index';

export class DefaultCommandHandler extends AbstractCommandHandler {

    constructor( @Inject("Container") protected container: IContainer) {
        super();
        super.initializeProvider(container);
    }

    @Action({ action: "create" })
    createAsync(entity:any) {
        return this.provider.createAsync(this.schema, entity);
    }

    @Action({ action: "update" })
    async updateAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.getAsync(this.schema, entity[keyProperty]);
        if (!old)
            throw new Error("Entity doesn't exist for updating");

        let result = await this.provider.updateAsync(this.schema, entity, old);
        return result;
    }

    @Action({ action: "delete" })
    deleteAsync(entity: any) {
        if (!entity)
            throw new Error("Entity is required");

        let keyProperty = this.schema.getIdProperty();
        return this.provider.deleteAsync(this.schema, entity[keyProperty]);
    }
}

export class DefaultQueryHandler extends AbstractQueryHandler {

    constructor( @Inject("Container") protected container: IContainer) {
        super();
        super.initializeProvider(container);
    }

    @Action({ action: "get" })
    getAsync(id: any) {
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        return this.provider.findOneAsync(this.schema, query);
    }

    @Action({ action: "search" })
    getAllAsync(query: any) {
        let options = { limit: this.query.limit, page: this.query.page };
        return this.provider.getAllAsync(this.schema, options);
    }
}