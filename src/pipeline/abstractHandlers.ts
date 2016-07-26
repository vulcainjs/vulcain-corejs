import {ActionData, ActionResponse, ActionMetadata, EventData, ActionEventMode} from './actions';
import {RequestContext, Pipeline} from '../servers/requestContext';
import {QueryData, QueryMetadata, QueryActionMetadata} from './query';
import {IContainer} from '../di/resolvers';
import {Inject} from '../di/annotations';
import 'reflect-metadata';
const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export interface IActionMetadata {
    eventMode?: ActionEventMode;
    action: string;
    scope?: string;
    schema: string;
    inputSchema?: string;
}

export abstract class AbstractActionHandler {
    action: ActionData;
    private _requestContext: RequestContext;

    constructor( @Inject("Container") protected container: IContainer) {
    }

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container, Pipeline.inProcess);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    get metadata(): IActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export interface IEventMetadata {
    action: string;
    schema: string;
}

export abstract class AbstractEventHandler {
    event: EventData;
    private _requestContext: RequestContext;

    constructor( @Inject("Container") protected container: IContainer) {
    }

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container, Pipeline.inProcess);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    get metadata() : IEventMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataEvents() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export interface IQueryMetadata {
    action: string;
    scope?: string;
    schema: string;
    inputSchema?: string;
}

export abstract class AbstractQueryHandler {
    query: QueryData;
    private _requestContext: RequestContext;

    constructor( @Inject("Container") protected container: IContainer) {
    }

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container, Pipeline.inProcess);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    get metadata(): IQueryMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }
    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}