import {MessageBus} from './messageBus';
import {IContainer} from '../di/resolvers';
import {Domain} from '../schemas/schema';
import {DefaultServiceNames} from '../di/annotations';
import { HandlerFactory, CommonRequestData, CommonMetadata, ErrorResponse, CommonRequestResponse, CommonActionMetadata, IManager, ServiceHandlerMetadata } from './common';
import * as os from 'os';
import {RequestContext, Pipeline} from '../servers/requestContext';
import * as RX from 'rx';
import {EventHandlerFactory} from './eventHandlerFactory';
import {Conventions} from '../utils/conventions';
import { ServiceDescriptors } from './serviceDescriptions';
import { System } from './../configurations/globals/system';
import { CommandRuntimeError } from './../errors/commandRuntimeError';
import { HttpResponse, BadRequestResponse, VulcainResponse } from './response';
const guid = require('uuid');

export interface ActionData extends CommonRequestData {
    service: string;
    // Internal
    status?: "Error" | "Success" | "Pending";
    taskId?: string;
    startedAt: string;
}

export interface ConsumeEventMetadata {
    description: string;
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

/**
 * Declare default action handler definition
 *
 * @export
 * @interface ActionHandlerMetadata
 * @extends {ServiceHandlerMetadata}
 */
export interface ActionHandlerMetadata extends ServiceHandlerMetadata {
    /**
     *
     *
     * @type {boolean}
     * @memberOf ActionHandlerMetadata
     */
    async?: boolean;
    /**
     *
     *
     * @type {EventNotificationMode}
     * @memberOf ActionHandlerMetadata
     */
    eventMode?: EventNotificationMode;
}

/**
 *
 *
 * @export
 * @interface ActionMetadata
 * @extends {CommonActionMetadata}
 */
export interface ActionMetadata extends CommonActionMetadata {
    async?: boolean;
    eventMode?: EventNotificationMode;
    outputSchema: string | Function;
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
    private _serviceId: string;
    private _initialized = false;
    private _serviceDescriptors: ServiceDescriptors;

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

    get serviceId() {
        return this._serviceId;
    }

    constructor(public container: IContainer) {
        this._hostname = os.hostname();
        this._serviceId = process.env[Conventions.instance.ENV_SERVICE_NAME] + "-" + process.env[Conventions.instance.ENV_SERVICE_VERSION];
        if (!this._serviceId)
            throw new Error("VULCAIN_SERVICE_NAME and VULCAIN_SERVICE_VERSION must be defined.");
    }

    public startMessageBus(hasAsyncTasks:boolean) {
        this.messageBus = new MessageBus(this, hasAsyncTasks);
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
            taskId: command.taskId
        };
        if (error)
            res.error = { message: error.message, errors: error.errors };
        return res;
    }

    private async validateRequestData(ctx: RequestContext, info, command) {
        let errors;
        let inputSchema = info.metadata.inputSchema;
        if (inputSchema && inputSchema !== "none") {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                command.inputSchema = schema.name;

                // Custom binding if any
                command.params = schema && schema.bind(command.params);

                errors = await schema.validateAsync(ctx, command.params);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }

            if (!errors || errors.length === 0) {
                // Search if a method naming validate<schema>[Async] exists
                let methodName = 'validate' + inputSchema;
                let altMethodName = methodName + 'Async';
                errors = info.handler[methodName] && info.handler[methodName](command.params, command.action);
                if (!errors)
                    errors = info.handler[altMethodName] && await info.handler[altMethodName](command.params, command.action);
                if (errors && !Array.isArray(errors))
                    errors = [errors];
            }
        }

        return errors;
    }

    getInfoHandler(command: CommonRequestData, container?:IContainer) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo<ActionMetadata>(container, command.schema, command.action);
        return info;
    }

    async runAsync(command: ActionData, ctx: RequestContext): Promise<HttpResponse> {
        let info = this.getInfoHandler(command, ctx.container);
        if (info.kind !== "action")
            return new BadRequestResponse("Query handler must be requested with GET.");

        let eventMode = info.metadata.eventMode || EventNotificationMode.successOnly;
        System.log.write(ctx, { RunAction: command });
        try {
            let errors = await this.validateRequestData(ctx, info, command);
            if (errors && errors.length > 0) {
                return new BadRequestResponse(this.createResponse(ctx, command, { message: "Validation errors", errors: errors }));
            }

            command.schema = <string>info.metadata.schema;
            command.correlationId = ctx.correlationId;
            command.correlationPath = ctx.correlationPath;
            command.startedAt = System.nowAsString();
            command.service = this._serviceId;
            command.userContext = ctx.user || <any>{};

            // Register asynchronous task
            if (!info.metadata.async) {

                info.handler.requestContext = ctx;
                info.handler.command = command;
                let result: HttpResponse = await info.handler[info.method](command.params);

                command.status = "Success";
                let res = this.createResponse(ctx, command);
                res.completedAt = System.nowAsString();
                if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                    this.messageBus.sendEvent(res);
                }

                if (!(result instanceof HttpResponse)) {
                    res.value = HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
                    return new VulcainResponse(res);
                }
                else if (result.contentType === HttpResponse.VulcainContentType) {
                    result.content = HandlerFactory.obfuscateSensibleData(this.domain, this.container, result.content);
                }
                return result;
            } else {
                // Pending
                this.messageBus.pushTask(command);
                return new VulcainResponse(this.createResponse(ctx, command));
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error : e;
            let res = this.createResponse(ctx, command, error);
            return new HttpResponse(res, e.statusCode);
        }
    }

    async consumeTaskAsync(command: ActionData) {
        let ctx = new RequestContext(this.container, Pipeline.HttpRequest);
        ctx.correlationId = command.correlationId || guid.v4();
        ctx.correlationPath = "event-";
        System.log.write(ctx, { runEvent: command });

        let info = this.getInfoHandler(command, ctx.container);
        let eventMode = info.metadata.eventMode || EventNotificationMode.always;

        let res;
        try {
            ctx.user = command.userContext;
            ctx.tenant = command.userContext.tenant;
            info.handler.requestContext = ctx;
            info.handler.command = command;
            let result = await info.handler[info.method](command.params);
            if (result instanceof HttpResponse) {
                throw new Error("Custom Http Response is not valid in an async action");
            }
            command.status = "Success";
            res = this.createResponse(ctx, command);
            res.value = HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
            res.commandMode = "async";
            res.completedAt = System.nowAsString();
            if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                this.messageBus.sendEvent(res);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error : e;
            res = this.createResponse(ctx, command, { message: error.message });
            res.commandMode = "async";
            res.completedAt = System.nowAsString();
            if (eventMode === EventNotificationMode.always) {
                this.messageBus.sendEvent(res);
            }
            System.log.error(ctx, e, `Error when processing async action : ${JSON.stringify(command)}`);
        }
        finally {
            ctx.dispose();
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
                let ctx = new RequestContext(this.container, Pipeline.EventNotification);
                ctx.correlationId = evt.correlationId || guid.v4();
                ctx.correlationPath = "-";

                try {
                    ctx.user = evt.userContext || <any>{};
                    handler = ctx.container.resolve(info.handler);
                    handler.requestContext = ctx;
                    handler.event = evt;
                }
                catch (e) {
                    System.log.error(ctx, e, `Unable to create handler ${info.handler.name}`);
                }

                try {
                    handler[info.methodName](evt.value);
                }
                catch (e) {
                    let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
                    System.log.error(ctx, error, `Error with event handler ${info.handler.name} event : ${evt}`);
                }
            }
        });
    }
}
