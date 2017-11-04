import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import { AbstractProviderCommand } from "../commands/abstractProviderCommand";
import { AbstractActionHandler, AbstractQueryHandler } from "../pipeline/handlers/abstractHandlers";
import { Action, Query } from "../pipeline/handlers/annotations";
import { ICommand } from "../commands/abstractCommand";
import { Command } from "../commands/commandFactory";
import { ApplicationError } from './../pipeline/errors/applicationRequestError';
import { CommandFactory } from '../commands/commandFactory';
import { System } from '../globals/system';

export class DefaultCRUDCommand extends AbstractProviderCommand<any> {
    create(entity: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.tracker.trackAction("create");
        return this.provider.create( this.schema, entity);
    }

    async createWithSensibleData(entity: any) {
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.create(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    async update(entity: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.tracker.trackAction("update");
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.get(this.schema, entity[keyProperty]);
        if (!old)
            throw new ApplicationError("Entity doesn't exist for updating : " + entity[keyProperty]);
        return await this.provider.update(this.schema, entity, old);
    }

    async updateWithSensibleData(entity: any) {
        // TODO move to provider
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.update(entity);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    deleteWithSensibleData(entity: any) {
        return this.delete(entity);
    }

    delete(entity: any) {
        this.context.tracker.trackAction("delete");
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        let keyProperty = this.schema.getIdProperty();
        return this.provider.delete(this.schema, entity[keyProperty]);
    }

    async get(id: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.tracker.trackAction("get");
        let keyProperty = this.schema.getIdProperty();
        let query = {};
        query[keyProperty] = id;
        return await this.provider.findOne(this.schema, query);
    }

    async getWithSensibleData(id: any) {
        let entity = await this.get(id);
        if (entity && this.schema.description.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    getAll(options: any) {
        this.setMetricTags(this.provider.address, this.schema && this.schema.name, this.context && this.context.user.tenant);
        this.context.tracker.trackAction("getAll");
        return this.provider.getAll(this.schema, options);
    }

    async getAllWithSensibleData(options: any) {
        let list = await this.getAll(options);
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

function createCommandName(metadata, kind) {
    return metadata.schema + kind + "Command";
}

export class DefaultActionHandler extends AbstractActionHandler {

    private defineCommand(metadata) {
        CommandFactory.registerCommand(DefaultCRUDCommand, {}, createCommandName(metadata, "Action"));
    }

    protected getDefaultCommand<T>() {
        return this.context.getCommand<T>(createCommandName(this.metadata, "Action"), this.metadata.schema);
    }

    constructor( @Inject("Container") container: IContainer) {
        super(container);
    }

    @Action({ action: "create", description: "Create a new entity" , outputSchema:""})
    async create(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.getDefaultCommand<DefaultCRUDCommand>();
        return cmd.createWithSensibleData(entity);
    }

    @Action({ action: "update", description: "Update an entity", outputSchema:"" }) // Put outputSchema empty to take the default schema
    async update(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.getDefaultCommand<DefaultCRUDCommand>();
        return cmd.updateWithSensibleData( entity);
    }

    @Action({ action: "delete", description: "Delete an entity", outputSchema:"boolean" })
    async delete(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");

        let cmd = this.getDefaultCommand<DefaultCRUDCommand>();
        return cmd.deleteWithSensibleData( entity);
    }
}

export class DefaultQueryHandler<T> extends AbstractQueryHandler {

    private defineCommand(metadata) {
        CommandFactory.registerCommand(DefaultCRUDCommand, {}, createCommandName(metadata, "Query"));
    }

    protected getDefaultCommand<T>() {
        return this.context.getCommand<T>(createCommandName(this.metadata, "Query"), this.metadata.schema);
    }

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    @Query({ action: "get", description: "Get an entity by id" })
    async get(id: any): Promise<T> {
        let cmd = this.getDefaultCommand<DefaultCRUDCommand>();
        return await cmd.getWithSensibleData(id);
    }

    @Query({ action: "all", description: "Get all entities" })
    async getAll(query?: any,  maxByPage?:number, page?:number) : Promise<Array<T>> {
        let options = {
            maxByPage: maxByPage || this.context.requestData.maxByPage || 0,
            page: page || this.context.requestData.page || 0,
            query: query || {}
        };
        let cmd = this.getDefaultCommand<DefaultCRUDCommand>();
        return await cmd.getAllWithSensibleData(options);
    }
}
