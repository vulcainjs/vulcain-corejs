import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import { AbstractProviderCommand } from "../commands/abstractProviderCommand";
import { AbstractActionHandler, AbstractQueryHandler } from "../pipeline/handlers/abstractHandlers";
import { Action } from "../pipeline/handlers/action/annotations";
import { Query } from "../pipeline/handlers/query/annotations.query";
import { ICommand } from "../commands/abstractCommand";
import { Command } from "../commands/commandFactory";
import { ApplicationError } from './../pipeline/errors/applicationRequestError';
import { CommandFactory } from '../commands/commandFactory';
import { Service } from '../globals/system';
import { QueryResult } from '../pipeline/handlers/query/queryResult';
import { Property } from '../schemas/builder/annotations.property';
import { InputModel } from '../schemas/builder/annotations.model';

@InputModel()
export class IdArguments {
    @Property({type:"id"})
    id: any;
}

export class DefaultCRUDCommand extends AbstractProviderCommand<any> {
    create(entity: any) {
        this.setMetricTags("create", this.provider.address, (this.schema && this.schema.name) || null, (this.context && this.context.user.tenant) || null);
        return this.provider.create( this.schema, entity);
    }

    async createWithSensibleData(entity: any) {
        if (entity && this.schema.info.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.create(entity);
        if (entity && this.schema.info.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    async update(entity: any) {
        this.setMetricTags("update", this.provider.address, (this.schema && this.schema.name) || null, (this.context && this.context.user.tenant) || null);
        let keyProperty = this.schema.getIdProperty();
        let old = await this.provider.get(this.schema, entity[keyProperty]);
        if (!old)
            throw new ApplicationError("Entity doesn't exist for updating : " + entity[keyProperty]);
        return await this.provider.update(this.schema, entity, old);
    }

    async updateWithSensibleData(entity: any) {
        // TODO move to provider
        if (entity && this.schema.info.hasSensibleData)
            entity = this.schema.encrypt(entity) || entity;
        entity = await this.update(entity);
        if (entity && this.schema.info.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    deleteWithSensibleData(id: any) {
        return this.delete(id);
    }

    async delete(id: any) {
        this.setMetricTags("delete", this.provider.address, (this.schema && this.schema.name) || null, (this.context && this.context.user.tenant) || null);
        return this.provider.delete(this.schema, id);
    }

    async get(args: any) {
        this.setMetricTags("get", this.provider.address, (this.schema && this.schema.name) || null, (this.context && this.context.user.tenant) || null);
        let keyProperty = this.schema.getIdProperty();
        if (args && !(typeof args === "object")) {
            args[keyProperty] = args;    
        }

        if (!args || !args[keyProperty])
            throw new ApplicationError("GET: You must provide an identifier");    
        
        // Create a query object without the _schema element
        let query = {};
        Object.keys(args).forEach(k => {
            if (k !== "_schema")
                query[k] = args[k];    
        });
        return await this.provider.findOne(this.schema, query);
    }

    async getWithSensibleData(id: any) {
        let entity = await this.get(id);
        if (entity && this.schema.info.hasSensibleData)
            entity = this.schema.decrypt(entity) || entity;
        return entity;
    }

    getAll(options: any): Promise<QueryResult> {
        this.setMetricTags("getAll", this.provider.address, (this.schema && this.schema.name) || null, (this.context && this.context.user.tenant) || null);
        let query = {};
        Object.keys(options).forEach(k => {
            if (k !== "_schema")
                query[k] = options[k];    
        });
        return this.provider.getAll(this.schema, options);
    }

    async getAllWithSensibleData(options: any) {
        let result = await this.getAll(options);
        if (result && result.value && result.value.length > 0 && this.schema.info.hasSensibleData) {
            let list = [];
            for (let entity of result.value) {
                if (entity) {
                    entity = this.schema.decrypt(entity) || entity;
                    list.push(entity);
                }
            }
            result.value = list;
        }
        return result;
    }
}

function createCommandName(metadata, kind) {
    return metadata.schema + kind + "Command";
}

export class DefaultActionHandler extends AbstractActionHandler {

    protected defineCommand(metadata) {
        CommandFactory.registerCommand(DefaultCRUDCommand, {}, createCommandName(metadata, "Action"));
    }

    protected createDefaultCommand<T>() {
        return CommandFactory.createCommand<T>(this.context, createCommandName(this.metadata, "Action"), this.metadata.schema);
    }

    constructor( @Inject("Container") container: IContainer) {
        super(container);
    }

    @Action({ name: "create", description: "Create a new entity" , outputSchema:""})
    async create(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.createDefaultCommand<DefaultCRUDCommand>();
        return cmd.createWithSensibleData(entity);
    }

    @Action({ name: "update", description: "Update an entity", outputSchema:"" }) // Put outputSchema empty to take the default schema
    async update(entity: any) {
        if (!entity)
            throw new ApplicationError("Entity is required");
        let cmd = this.createDefaultCommand<DefaultCRUDCommand>();
        return cmd.updateWithSensibleData( entity);
    }

    @Action({ name: "delete", description: "Delete an entity", outputSchema:"", inputSchema:"IdArguments"})
    async delete(args: IdArguments) {
        let cmd = this.createDefaultCommand<DefaultCRUDCommand>();
        let res = await cmd.deleteWithSensibleData(args.id);
        return res;
    }
}

export class DefaultQueryHandler<T> extends AbstractQueryHandler {

    private defineCommand(metadata) {
        CommandFactory.registerCommand(DefaultCRUDCommand, {}, createCommandName(metadata, "Query"));
    }

    protected createDefaultCommand() {
        return CommandFactory.createCommand<DefaultCRUDCommand>(this.context, createCommandName(this.metadata, "Query"), this.metadata.schema);
    }

    constructor( @Inject("Container") container: IContainer ) {
        super(container);
    }

    @Query({ name: "get", description: "Get an entity by id", inputSchema: "IdArguments" })
    async get(id: any): Promise<T> {
        let cmd = this.createDefaultCommand();
        return await cmd.getWithSensibleData(id);
    }

    @Query({ name: "all", description: "Get all entities", outputCardinality:"many" })
    async getAll(query?: any,  pageSize?:number, page?:number) : Promise<QueryResult> {
        let options = {
            pageSize: pageSize || this.context.requestData.pageSize || 0,
            page: page || this.context.requestData.page || 0,
            query: query || {}
        };
        let cmd = this.createDefaultCommand();
        return await cmd.getAllWithSensibleData(options);
    }
}
