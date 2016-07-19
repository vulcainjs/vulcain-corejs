import {CommandData, CommandResponse, CommandMetadata, EventData} from './commands';
import {RequestContext} from '../servers/requestContext';
import {Query, QueryMetadata} from './query';
import 'reflect-metadata';
import {Schema} from '../schemas/schema';
import {IProvider} from '../providers/provider';
import {DefaultServiceNames} from '../application';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';

const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export abstract class AbstractCommandHandler {
    command: CommandData;
    requestContext: RequestContext;
    provider: IProvider<any>;
    schema: Schema;

    get metadata(): CommandMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }

    initializeProvider(container: IContainer) {
        this.provider = container.get<IProvider<any>>(DefaultServiceNames.Provider);
        this.schema = container.get<Domain>(DefaultServiceNames.Domain).getSchema(this.metadata.schema);
        this.provider.initializeWithSchema(this.schema);
    }
}

export abstract class AbstractEventHandler {
    event: EventData;
    requestContext: RequestContext;
    provider: IProvider<any>;
    schema: Schema;

    get metadata() {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataEvents() {
        return Reflect.getMetadata(symActions, this.constructor);
    }

    initializeProvider(container: IContainer) {
        this.provider = container.get<IProvider<any>>(DefaultServiceNames.Provider);
        this.schema = container.get<Domain>(DefaultServiceNames.Domain).getSchema(this.metadata.schema);
        this.provider.initializeWithSchema(this.schema);
    }
}

export abstract class AbstractQueryHandler {
    query: Query;
    requestContext: RequestContext;
    provider: IProvider<any>;
    schema: Schema;

    get metadata(): QueryMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }
    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }

    initializeProvider(container: IContainer) {
        this.provider = container.get<IProvider<any>>(DefaultServiceNames.Provider);
        this.schema = container.get<Domain>(DefaultServiceNames.Domain).getSchema(this.metadata.schema);
        this.provider.initializeWithSchema(this.schema);
    }
}