import {ActionData, ActionResponse, ActionMetadata, EventData} from './actions';
import {RequestContext} from '../servers/requestContext';
import {QueryData, QueryMetadata, QueryActionMetadata} from './query';
import {IContainer} from '../di/resolvers';
import 'reflect-metadata';
const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export abstract class AbstractActionHandler {
    action: ActionData;
    private _requestContext: RequestContext;

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    constructor(protected container: IContainer) {
    }

    get metadata(): ActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export abstract class AbstractEventHandler {
    event: EventData;
    private _requestContext: RequestContext;

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    constructor(protected container: IContainer) {
    }

    get metadata() {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataEvents() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export abstract class AbstractQueryHandler {
    query: QueryData;
    private _requestContext: RequestContext;

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container);
        }
        return this._requestContext;
    }

    set requestContext(ctx: RequestContext) {
        this._requestContext = ctx;
    }

    constructor(protected container: IContainer) {
    }

    get metadata(): QueryActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }
    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}