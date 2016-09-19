import {MessageBus} from './messageBus';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {DefaultServiceNames} from '../di/annotations';
import {HandlerFactory, CommonRequestData, CommonMetadata, ErrorResponse, CommonRequestResponse, CommonActionMetadata, IManager, CommonHandlerMetadata, ServiceHandlerMetadata} from './common';
const moment = require('moment');
const guid = require('node-uuid');
import * as os from 'os';
import {RequestContext, Pipeline, UserContext} from '../servers/requestContext';
import * as RX from 'rx';
import {CommandRuntimeError} from '../commands/command/command';
import {EventHandlerFactory} from './eventHandlerFactory';
import {LifeTime} from '../di/annotations';
import {Conventions} from '../utils/conventions';

export interface ActionData extends CommonRequestData {
    correlationId: string;
    data: any;
    service: string;
    // Internal
    status?: "Error" | "Success" | "Pending";
    taskId?: string;
    startedAt: string;
}

export interface ConsumeEventMetadata {
    subscribeToDomain?: string;
    subscribeToAction?: string;
    subscribeToSchema?: string;
    filter?: (observable: RX.Observable<EventData>) => RX.Observable<EventData>;
}

export interface EventMetadata extends CommonMetadata {
    subscribeToDomain?: string;
}

export enum EventNotificationMode {
    always,
    successOnly,
    never
}

export interface ActionHandlerMetadata extends ServiceHandlerMetadata {
    async?: boolean;
    eventMode?: EventNotificationMode;
}

export interface ActionMetadata extends CommonActionMetadata {
    async?: boolean;
    eventMode?: EventNotificationMode;
}

export interface ActionResponse<T> extends CommonRequestResponse<T> {
    correlationId: string;
    startedAt: string;
    completedAt?: string;
    service: string;
    taskId?: string;
    status: "Error" | "Success" | "Pending";
    commandMode?: string;
}

/**
 * Response for event
 *
 * @export
 * @interface EventData
 * @extends {ActionResponse<any>}
 */
export interface EventData extends ActionResponse<any> {

}

export class CommandManager implements IManager {

    private messageBus: MessageBus;
    private _domain: Domain;
    private _hostname: string;
    private _service: string;
    private _initialized = false;

    static commandHandlersFactory = new HandlerFactory();
    static eventHandlersFactory = new EventHandlerFactory();

    /**
     * Get the current domain model
     * @returns {Domain}
     */
    get domain() {
        if (!this._domain) {
            this._domain = this.container.get<Domain>(DefaultServiceNames.Domain);
        }
        return this._domain;
    }

    get serviceName() {
        return this._service;
    }

    constructor(public container: IContainer) {
        this._hostname = os.hostname();
        this._service = process.env[Conventions.ENV_SERVICE_NAME] + "-" + process.env[Conventions.ENV_SERVICE_VERSION];
        if (!this._service)
            throw new Error("VULCAIN_SERVICE_NAME and VULCAIN_SERVICE_VERSION must be defined.");
        this.messageBus = new MessageBus(this);
        this.subscribeToEvents();
    }

    private createResponse(ctx: RequestContext, command: ActionData, error?: ErrorResponse) {
        let res: ActionResponse<any> = {
            tenant: ctx.tenant,
            source: this._hostname,
            startedAt: command.startedAt,
            service: command.service,
            schema: command.schema,
            inputSchema: command.inputSchema,
            action: command.action,
            userContext: command.userContext,
            domain: command.domain,
            status: error ? "Error" : command.status,
            correlationId: command.correlationId,
            error: error,
            taskId: command.taskId
        }
        return res;
    }

    private async validateRequestData(info, command) {
        let errors;
        let inputSchema = info.metadata.inputSchema;
        if (inputSchema) {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                command.inputSchema = schema.name;

                // Custom binding if any
                command.data = schema && schema.bind(command.data);

                errors = this.domain.validate(command.data, schema);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }

            if (!errors || errors.length === 0) {
                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                let altMethodName = methodName + 'Async';
                errors = info.handler[methodName] && info.handler[methodName](command.data, command.action);
                if (!errors)
                    errors = info.handler[altMethodName] && await info.handler[altMethodName](command.data, command.action);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }
        }

        return errors;
    }

    getMetadata(command: CommonRequestData) {
        let info = CommandManager.commandHandlersFactory.getInfo<ActionMetadata>(null, command.domain, command.schema, command.action);
        return info.metadata;
    }

    async runAsync(command: ActionData, ctx: RequestContext) {
        let info = CommandManager.commandHandlersFactory.getInfo<ActionHandlerMetadata>(ctx.container, command.domain, command.schema, command.action);
        let eventMode = info.metadata.eventMode || EventNotificationMode.successOnly;

        try {
            let errors = await this.validateRequestData(info, command);
            if (errors && errors.length > 0)
                return this.createResponse(ctx, command, { message: "Validation errors", errors: errors });

            command.schema = <string>info.metadata.schema;
            command.correlationId = command.correlationId || guid.v4();
            command.startedAt = moment.utc().format();
            command.service = this._service;
            command.userContext = ctx.user || <any>{};

            // Register asynchronous task
            if (!(<ActionHandlerMetadata>info.metadata).async) {

                info.handler.requestContext = ctx;
                info.handler.command = command;
                let result = await info.handler[info.method](command.data);
                command.status = "Success";
                let res = this.createResponse(ctx, command);
                res.value = HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
                res.completedAt = moment.utc().format();
                if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                    this.messageBus.sendEvent(res);
                }
                return res;
            } else {
                // Pending
                this.messageBus.pushTask(command);
                return this.createResponse(ctx, command);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
            return this.createResponse(ctx, command, { message: error });
        }
    }

    async consumeTaskAsync(command: ActionData) {
        let ctx = new RequestContext(this.container, Pipeline.HttpRequest);
        let info = CommandManager.commandHandlersFactory.getInfo<ActionMetadata>(ctx.container, command.domain, command.schema, command.action);
        let eventMode = info.metadata.eventMode || EventNotificationMode.always;

        let res;
        try {
            ctx.user = command.userContext;
            ctx.tenant = command.userContext.tenant;
            info.handler.requestContext = ctx;
            info.handler.command = command;
            let result = await info.handler[info.method](command.data);
            command.status = "Success";
            res = this.createResponse(ctx, command);
            res.value = HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
            res.commandMode = "async";
            res.completedAt = moment.utc().format();
            if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                this.messageBus.sendEvent(res);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
            res = this.createResponse(ctx, command, { message: error });
            res.commandMode = "async";
            res.completedAt = moment.utc().format();
            if (eventMode === EventNotificationMode.always) {
                this.messageBus.sendEvent(res);
            }
        }
    }

    subscribeToEvents() {
        if (!this._initialized) {
            this._initialized = true;
            for (let item of CommandManager.eventHandlersFactory.allHandlers()) {
                this.bindEventHandler(<ConsumeEventMetadata>item.metadata);
            }
        }
    }

    bindEventHandler(metadata: ConsumeEventMetadata) {
        let events = this.messageBus.getEventsQueue(metadata.subscribeToDomain || this.domain.name);
        events = events.filter((e) => (metadata.subscribeToSchema === "*" || e.schema === metadata.subscribeToSchema));
        if (metadata.filter)
            events = metadata.filter(events);

        events.subscribe((evt: EventData) => {
            let handlers = CommandManager.eventHandlersFactory.getFilteredHandlers(evt.domain, evt.schema, evt.action);
            for (let info of handlers) {
                let handler;
                try {
                    let ctx = new RequestContext(this.container, Pipeline.EventNotification);
                    ctx.user = evt.userContext || <any>{};

                    handler = ctx.container.resolve(info.handler);
                    handler.requestContext = ctx;
                    handler.event = evt;
                }
                catch (e) {
                    console.log(`Unable to create handler ${info.handler.name}`);
                }

                try {
                    handler[info.methodName](evt);
                }
                catch (e) {
                    let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
                    console.log(`Error with event handler ${info.handler.name} event : ${evt} - Error : ${error}`);
                }
            }
        });
    }
}
