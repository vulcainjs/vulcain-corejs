import { IContainer } from '../../di/resolvers';
import { Inject, IScopedComponent } from '../../di/annotations';
import 'reflect-metadata';
import { RequestContext } from "../../pipeline/requestContext";
import { Pipeline, IRequestContext } from "../../pipeline/common";
import { EventNotificationMode, EventData } from "./messageBus";
const symMetadata = Symbol.for("handler:metadata");

export interface IActionMetadata {
    eventMode?: EventNotificationMode;
    action: string;
    scope?: string;
    schema: string;
    inputSchema?: string;
}

export abstract class AbstractHandler implements IScopedComponent {
    private _requestContext: RequestContext;

    constructor( @Inject("Container") public container: IContainer) {
    }

    get context(): IRequestContext {
        if (!this._requestContext) {
            this._requestContext = new RequestContext(this.container, Pipeline.HttpRequest); // TODO init metrics...
        }
        return this._requestContext;
    }

    set context(ctx: IRequestContext) {
        this._requestContext = <RequestContext>ctx;
    }

    get metadata(): IActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }
}

export abstract class AbstractActionHandler extends AbstractHandler {
}

export abstract class AbstractEventHandler extends AbstractHandler {
    event: EventData;
}

export abstract class AbstractQueryHandler extends AbstractHandler {
}
