import {ActionData, EventData, EventNotificationMode} from './actions';
import {RequestContext, Pipeline} from '../servers/requestContext';
import {QueryData} from './query';
import {IContainer} from '../di/resolvers';
import { Inject, DefaultServiceNames, IScopedComponent } from '../di/annotations';
import 'reflect-metadata';
const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export interface IActionMetadata {
    eventMode?: EventNotificationMode;
    action: string;
    scope?: string;
    schema: string;
    inputSchema?: string;
}

export abstract class AbstractHandler implements IScopedComponent {
   private _requestContext: RequestContext;

    constructor( @Inject("Container") protected container: IContainer) {
    }

    get requestContext(): RequestContext {
        if (!this._requestContext) {
            this._requestContext = <RequestContext>this.container.get(DefaultServiceNames.RequestContext, true) || new RequestContext(this.container, Pipeline.InProcess);
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

export abstract class AbstractActionHandler extends AbstractHandler{
    action: ActionData;
}

export interface IEventMetadata {
    action: string;
    schema: string;
}

export abstract class AbstractEventHandler extends AbstractHandler {
    event: EventData;
}

export interface IQueryMetadata {
    action: string;
    scope?: string;
    schema: string;
    inputSchema?: string;
}

export abstract class AbstractQueryHandler extends AbstractHandler {
    query: QueryData;
}
