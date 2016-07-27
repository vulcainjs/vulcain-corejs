import {MessageBus} from './messageBus';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {Application} from '../application';
import {DefaultServiceNames} from '../application'
import {HandlerFactory, CommonRequestData, CommonMetadata, ValidationError, RuntimeError, ErrorResponse, CommonRequestResponse, CommonActionMetadata, IManager, CommonHandlerMetadata} from './common';
const moment = require('moment');
const guid = require('node-uuid');
import * as os from 'os';
import {RequestContext, Pipeline} from '../servers/requestContext';
import * as RX from 'rx';
import {CommandRuntimeError} from '../commands/command/command';

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
    action?: string;
    schema?: string;
    filter?: (observable: RX.Observable<EventData>) => RX.Observable<EventData>;
}

export interface EventMetadata extends CommonMetadata {
    domain: string;
}

export enum ActionEventMode {
    always,
    successOnly,
    never
}

export interface ActionHandlerMetadata extends CommonHandlerMetadata {
    async?: boolean;
    eventMode?: ActionEventMode;
}

export interface ActionMetadata extends CommonActionMetadata {
    eventMode?: ActionEventMode;
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

export interface EventData extends ActionResponse<any> {

}

export class CommandManager implements IManager {

    private messageBus: MessageBus;
    private _domain: Domain;
    private _hostname: string;
    private _service: string;
    private _initialized = false;

    static commandHandlersFactory = new HandlerFactory();
    static eventHandlersFactory= new HandlerFactory();

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
        this._service = process.env.VULCAIN_SERVICE_NAME + "-" + process.env.VULCAIN_SERVICE_VERSION;
        if (!this._service)
            throw new Error("VULCAIN_SERVICE_NAME and VULCAIN_SERVICE_VERSION must be defined.");
        this.messageBus = new MessageBus(this);
        this.subscribeToEvents();
    }

    private createResponse(command: ActionData, error?: ErrorResponse) {
        let res: ActionResponse<any> = {
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
        let data = command.data;
        let inputSchema = info.metadata.inputSchema || info.metadata.schema;
        if (inputSchema) {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                command.inputSchema = schema.name;
                errors = this.domain.validate(data, schema);
            }

            if (!errors || errors.length === 0) {
                // Custom binding if any
                if (schema)
                    data = schema && schema.bind(data);

                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                let altMethodName = methodName + 'Async';
                errors = info.handler[methodName] && await info.handler[methodName](data);
                if (!errors)
                    errors = info.handler[altMethodName] && await info.handler[altMethodName](data);
            }
        }

        return errors;
    }

    getMetadata(command: CommonRequestData) {
        let info = CommandManager.commandHandlersFactory.getInfo<ActionMetadata>(null, command.domain, command.schema, command.action);
        return info.metadata;
    }

    async runAsync(command: ActionData, ctx: RequestContext) {
        let info = CommandManager.commandHandlersFactory.getInfo<ActionHandlerMetadata>(this.container, command.domain, command.schema, command.action);
        let eventMode = info.metadata.eventMode || ActionEventMode.always;

        try {
            let errors = await this.validateRequestData(info, command);
            if (errors && errors.length > 0)
                return this.createResponse(command, { message: "Validation errors", errors: errors });

            command.schema = <string>info.metadata.schema;
            command.correlationId = command.correlationId || guid.v4();
            command.startedAt = moment.utc().format();
            command.service = this._service;
            if (ctx && ctx.user)
                command.userContext = { id: ctx.user.id, name: ctx.user.name, scopes: ctx.scopes, displayName: ctx.user.displayName };
            else
                command.userContext = <any>{};

            if (!(<ActionHandlerMetadata>info.metadata).async) {

                info.handler.requestContext = ctx;
                info.handler.command = command;
                let result = await info.handler[info.method](command.data);
                command.status = "Success";
                let res = this.createResponse(command);
                res.value = result;
                res.completedAt = moment.utc().format();
                if (eventMode === ActionEventMode.always || eventMode === ActionEventMode.successOnly) {
                    this.messageBus.sendEvent(res);
                }
                return res;
            } else {
                // Pending
                this.messageBus.pushTask(command);
                return this.createResponse(command);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
            return this.createResponse(command, { message: error });
        }
    }

    async consumeTaskAsync(command: ActionData) {
        let info = CommandManager.commandHandlersFactory.getInfo<ActionMetadata>(this.container, command.domain, command.schema, command.action);
        let eventMode = info.metadata.eventMode || ActionEventMode.always;

        let res;
        try {
            let ctx = new RequestContext(this.container, Pipeline.Http);
            ctx.user = command.userContext;
            info.handler.requestContext = ctx;
            info.handler.command = command;
            let result = await info.handler[info.method](command.data);
            command.status = "Success";
            res = this.createResponse(command);
            res.value = result;
            res.commandMode = "async";
            res.completedAt = moment.utc().format();
            if (eventMode === ActionEventMode.always || eventMode === ActionEventMode.successOnly) {
                this.messageBus.sendEvent(res);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
            res = this.createResponse(command, { message: error });
            res.commandMode = "async";
            res.completedAt = moment.utc().format();
            if (eventMode === ActionEventMode.always) {
                this.messageBus.sendEvent(res);
            }
        }
    }

    subscribeToEvents() {
        if (!this._initialized) {
            this._initialized = true;
            for (let item of CommandManager.eventHandlersFactory.handlers.values()) {
                this.bindEventHandler(<ConsumeEventMetadata>item.metadata);
            }
        }
    }

    bindEventHandler(metadata: ConsumeEventMetadata) {
        let events = this.messageBus.getEventsQueue(this.domain.name);
        events = events.filter((e) => e.action === metadata.action && e.schema === metadata.schema);
        if (metadata.filter)
            events = metadata.filter(events);

        events.subscribe((evt: EventData) => {
            let info = CommandManager.eventHandlersFactory.getInfo<EventMetadata>(this.container, evt.domain, evt.schema, evt.action, true);
            if (info) {
                let ctx = new RequestContext(this.container, Pipeline.eventNotification);
                ctx.user = (evt.userContext && evt.userContext.user) || {};
                info.handler.requestContext = ctx;
                info.handler.event = evt;
                info.handler[info.method](evt.value);
            }
        });
    }
}