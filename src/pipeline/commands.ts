import {MessageBus} from './messageBus';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {Application} from '../application';
import {HandlerFactory, CommonRequestData, CommonMetadata, ValidationError, RuntimeError, ErrorResponse, CommonResponse, CommonHandlerMetadata, IManager, CommonActionMetadata} from './common';
const moment = require('moment');
const guid = require('node-uuid');
import * as os from 'os';
import {RequestContext} from '../servers/requestContext';

export interface Command extends CommonRequestData {
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
}

export interface EventMetadata extends CommonMetadata {
}

export interface CommandMetadata extends CommonHandlerMetadata {
    async?: boolean;
}

export interface ActionMetadata extends CommonActionMetadata {
}

export interface CommandResponse extends CommonResponse {
    correlationId: string;
    startedAt: string;
    completedAt?: string;
    service: string;
    taskId?: string;
    status: "Error" | "Success" | "Pending";
    commandMode?: string;
}

export class CommandManager implements IManager {

    private messageBus: MessageBus;
    private _domain: Domain;
    private _hostname: string;
    private _service: string;

    static commandHandlersFactory = new HandlerFactory();
    static eventHandlersFactory= new HandlerFactory();

    /**
     * Get the current domain model
     * @returns {Domain}
     */
    get domain() {
        if (!this._domain) {
            this._domain = this.container.get("Domain");
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
    }

    private createResponse(command: Command, error?: ErrorResponse) {
        let res: CommandResponse = {
            source: this._hostname,
            startedAt: command.startedAt,
            service: command.service,
            schema: command.schema,
            action: command.action,
            context: command.context,
            domain: command.domain,
            status: error ? "Error" : command.status,
            correlationId: command.correlationId,
            error: error,
            taskId: command.taskId
        }
        return res;
    }

    private async validateRequestData(info, data) {
        let errors;
        let schema = info.metadata.schema && this.domain.getSchema(info.metadata.schema);
        if (schema) {
            errors = this.domain.validate(data, schema);
        }
        if (!errors || errors.length === 0)
            errors = info.handler.validateModelAsync && await info.handler.validateModelAsync(data);
        return errors;
    }

    getMetadata(command: CommonRequestData) {
        let info = CommandManager.commandHandlersFactory.getInfo<CommandMetadata>(this.container, command.domain, command.action);
        return info.metadata;
    }

    async runAsync(command: Command, ctx: RequestContext) {
        let info = CommandManager.commandHandlersFactory.getInfo<CommandMetadata>(this.container, command.domain, command.action);

        try {
            let errors = await this.validateRequestData(info, command.data);
            if (errors && errors.length > 0)
                return this.createResponse(command, { message: "Validation errors", errors: errors });

            command.correlationId = command.correlationId || guid.v4();
            command.startedAt = moment.utc().format();
            command.service = this._service;
            if (ctx && ctx.user)
                command.context = { id: ctx.id, name: ctx.name, scopes: ctx.user.scopes, displayName: ctx.user.displayName };
            else
                command.context = <any>{};

            if (!(<CommandMetadata>info.metadata).async) {

                info.handler.requestContext = ctx;
                info.handler.command = command;
                let result = await info.handler[info.method](command.data);
                command.status = "Success";
                let res = this.createResponse(command);
                res.value = result;
                res.completedAt = moment.utc().format();
                this.messageBus.sendEvent(res);
                return res;
            } else {
                // Pending
                this.messageBus.pushTask(command);
                return this.createResponse(command);
            }
        }
        catch (e) {
            return this.createResponse(command, { message: e.message || e.toString() });
        }
    }

    async consumeTaskAsync(command: Command) {
        let info = CommandManager.commandHandlersFactory.getInfo<CommandMetadata>(this.container, command.domain, command.action);
        let res;
        try {
            let ctx = new RequestContext(this.container);
            ctx.user = (command.context && command.context.user);
            info.handler.requestContext = ctx;
            info.handler.command = command;
            let result = await info.handler[info.method](command.data);
            command.status = "Success";
            res = this.createResponse(command);
            res.value = result;
        }
        catch (e) {
            res = this.createResponse(command, { message: e.message || e.toString() });
        }

        res.commandMode = "async";
        res.completedAt = moment.utc().format();
        this.messageBus.sendEvent(res);
    }

    async consumeEventAsync(event: CommandResponse) {
        let info = CommandManager.eventHandlersFactory.getInfo<EventMetadata>(this.container, event.domain, event.action, true);
        if (info) {
            let ctx = new RequestContext(this.container);
            ctx.user = (event.context && event.context.user) || {};
            info.handler.requestContext = ctx;
            info.handler.event = event;
            info.handler[info.method](event.value);
        }
        console.log("Receive event : %j", event);
    }
}