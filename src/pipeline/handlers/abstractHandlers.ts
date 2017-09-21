import {IContainer} from '../../di/resolvers';
import { Inject, DefaultServiceNames, IScopedComponent } from '../../di/annotations';
import 'reflect-metadata';
import { RequestContext } from "../../pipeline/requestContext";
import { Pipeline, IRequestContext } from "../../pipeline/common";
import { ICommand } from "../../commands/abstractCommand";
import { EventNotificationMode, EventData } from "./messageBus";
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

    constructor( @Inject("Container") public container: IContainer) {
    }

    get requestContext(): IRequestContext {
        if (!this._requestContext) {
            this._requestContext = <RequestContext>this.container.get(DefaultServiceNames.RequestContext, true)
                || new RequestContext(this.container, Pipeline.HttpRequest); // TODO init metrics...
        }
        return this._requestContext;
    }

    set requestContext(ctx: IRequestContext) {
        this._requestContext = <RequestContext>ctx;
    }

    get metadata(): IActionMetadata {
        return Reflect.getMetadata(symMetadata, this.constructor);
    }

    /**
     * Create a new command instance.
     *
     * @param commandName Command name
     * @param schema Schema to use for the command provider (default = schema defined for the handler)
     */
    createCommandAsync<T = ICommand>(commandName: string, schema?: string) {
        return <T><any>this._requestContext.getCommandAsync(commandName, schema || (this.metadata && this.metadata.schema));
    }
}

export abstract class AbstractActionHandler extends AbstractHandler{
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
}
