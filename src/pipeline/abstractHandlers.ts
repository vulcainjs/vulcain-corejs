import {ActionData, ActionResponse, ActionMetadata, EventData} from './actions';
import {RequestContext} from '../servers/requestContext';
import {QueryData, QueryMetadata} from './query';
import 'reflect-metadata';
const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export abstract class AbstractActionHandler {
    action: ActionData;
    requestContext: RequestContext;

    get metadata(): ActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export abstract class AbstractEventHandler {
    event: EventData;
    requestContext: RequestContext;

    get metadata() {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    get metadataEvents() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}

export abstract class AbstractQueryHandler {
    query: QueryData;
    requestContext: RequestContext;

    get metadata(): QueryMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }
    get metadataActions() {
        return Reflect.getMetadata(symActions, this.constructor);
    }
}