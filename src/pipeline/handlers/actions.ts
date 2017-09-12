import { MessageBus, EventNotificationMode, ConsumeEventMetadata, EventData } from './messageBus';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/schema';
import { DefaultServiceNames } from '../../di/annotations';
import { VulcainLogger } from '../../log/vulcainLogger';
import { HandlerFactory, CommonMetadata, ErrorResponse, CommonActionMetadata, IManager, ServiceHandlerMetadata } from './common';
import * as os from 'os';
import * as RX from 'rxjs';
import { EventHandlerFactory } from './eventHandlerFactory';
import { Conventions } from '../../utils/conventions';
import { ServiceDescriptors } from './serviceDescriptions';
import { System } from '../../globals/system';
import { RequestContext } from "../../pipeline/requestContext";
import { RequestData, Pipeline, ICustomEvent } from "../../pipeline/common";
import { CommandRuntimeError } from "../errors/commandRuntimeError";
import { UserContext } from "../../security/securityManager";
import { HttpResponse } from "../response";
import { ApplicationRequestError } from "../errors/applicationRequestError";
import { BadRequestError } from "../errors/badRequestError";
import { ITaskManager } from "../../providers/taskManager";

export interface AsyncTaskData extends RequestData {
    status?: "Error" | "Success" | "Pending";
    taskId?: string;
    startedAt?: string;
    userContext?: UserContext;
    completedAt?: string;
}

export interface ActionResult {
    value?;
    status?: "Error" | "Success" | "Pending";
    taskId?: string;
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
    outputSchema: string;
}

export class CommandManager implements IManager {

    private messageBus: MessageBus;
    private _domain: Domain;
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

    constructor(public container: IContainer) {
        let descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        let hasAsyncTasks = descriptors.getDescriptions().hasAsyncTasks;
        this.startMessageBus(hasAsyncTasks);
    }

    public startMessageBus(hasAsyncTasks: boolean) {
        this.messageBus = new MessageBus(this, hasAsyncTasks);
        this.subscribeToEvents();
    }

    private sendCustomEvent(ctx: RequestContext) {
        let events = (<any>ctx)._customEvents;
        if (!events) {
            return;
        }

        events.forEach((event: ICustomEvent) => {
            let res = this.createEvent(ctx, "Pending", event.params);
            this.messageBus.sendEvent(res);
        });
        (<any>ctx)._customEvents = null;
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

    getInfoHandler(command: RequestData, container?: IContainer) {
        if (!this._serviceDescriptors) {
            this._serviceDescriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        }
        let info = this._serviceDescriptors.getHandlerInfo(container, command.schema, command.action);
        return info;
    }

    private createEvent(ctx: RequestContext, status: "Error" | "Pending" | "Success", result, error?): EventData {
        let event: EventData = {
            vulcainVerb: `${ctx.requestData.schema}.${ctx.requestData.action}`,
            correlationId: ctx.requestData.correlationId,
            action: ctx.requestData.action,
            schema: ctx.requestData.schema,
            source: System.fullServiceName,
            startedAt: System.nowAsString(),
            value: result && HandlerFactory.obfuscateSensibleData(this.domain, ctx.container, result),
            error: error && error.message,
            userContext: ctx.security.getUserContext(),
            status: status,
            domain: this._domain.name
        };
        return event;
    }

    async runAsync(command: RequestData, ctx: RequestContext): Promise<HttpResponse> {
        let info = this.getInfoHandler(command, ctx.container);
        if (info.kind !== "action")
            throw new ApplicationRequestError("Query handler must be requested with GET.", 405);

        let metadata = <ActionMetadata>info.metadata;
        let eventMode = metadata.eventMode || EventNotificationMode.successOnly;
        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);

        try {
            let errors = await this.validateRequestData(ctx, info, command);
            if (errors && errors.length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            command.schema = command.schema || <string>info.metadata.schema;

            // Synchronous task
            if (!metadata.async) {

                info.handler.requestContext = ctx;
                /** // Inject runAsyncTask in the current context
                (<any>ctx)._runAsyncTask = (action, schema, params) => {
                    let task = <RequestData>{ action, schema, params };
                    task.correlationId = ctx.correlationId;
                    task.startedAt = System.nowAsString();
                    task.service = this._serviceId;
                    task.userContext = task.userContext || command.userContext;
                    this.messageBus.pushTask(task);
                    };
                **/
                let resultRaw = await info.handler[info.method](Object.assign({}, command.params));
                let result = resultRaw && HandlerFactory.obfuscateSensibleData(this.domain, this.container, resultRaw);

                if (!(result instanceof HttpResponse)) {
                    let res: ActionResult = {
                        value: result,
                    };
                    result = new HttpResponse(res);
                }

                if (eventMode === EventNotificationMode.successOnly || eventMode === EventNotificationMode.always) {
                    this.messageBus.sendEvent(this.createEvent(ctx, "Success", resultRaw));
                }

                this.sendCustomEvent(ctx);

                return result;
            }
            else {
                // Asynchronous task
                let pendingTask: AsyncTaskData = Object.assign({}, ctx.getRequestDataObject(), {
                    startedAt: System.nowAsString(),
                    status: "Pending"
                });

                pendingTask.userContext = ctx.security.getUserContext();
                this.messageBus.pushTask(pendingTask);
                let taskManager = this.container.get<ITaskManager>(DefaultServiceNames.TaskManager, true);
                if (taskManager)
                    await taskManager.registerTaskAsync(pendingTask);

                let res = {
                    meta: {
                        taskId: pendingTask.taskId,
                        status: "Pending"
                    }
                };
                return new HttpResponse(res);
            }
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError) ? e.error : e;
            throw error;
        }
    }

    async processAsyncTaskAsync(command: AsyncTaskData) {
        let ctx = new RequestContext(this.container, Pipeline.HttpRequest, command);
        ctx.setSecurityManager(command.userContext); // TODO metrics

        let logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
        logger.logAction(ctx, "RE", command.action, JSON.stringify(command));

        let info = this.getInfoHandler(command, ctx.container);
        let metadata = <ActionMetadata>info.metadata;
        let eventMode = metadata.eventMode || EventNotificationMode.always;

        let res;
        try {
            info.handler.requestContext = ctx;
            let result = await info.handler[info.method](Object.assign({}, command.params));

            if (result instanceof HttpResponse) {
                throw new Error("Custom Http Response is not valid in an async action");
            }
            if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                result = result && HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
                let event = this.createEvent(ctx, "Success", result);
                event.completedAt = System.nowAsString();
                this.messageBus.sendEvent(event);
            }
            this.sendCustomEvent(ctx);
            command.status = "Success";
        }
        catch (e) {
            if (eventMode === EventNotificationMode.always) {
                let error = (e instanceof CommandRuntimeError) ? e.error : e;
                let event = this.createEvent(ctx, "Error", null, error);
                event.completedAt = System.nowAsString();
                this.messageBus.sendEvent(event);
            }
            System.log.error(ctx, e, () => `Error when processing async action : ${JSON.stringify(command)}`);
            command.status = "Error";
        }
        finally {
            command.completedAt = System.nowAsString();
            let taskManager = this.container.get<ITaskManager>(DefaultServiceNames.TaskManager, true);
            if (taskManager)
                await taskManager.updateTaskAsync(command);

            logger.logAction(ctx, "EE");
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

    /**
     *
     */
    private bindEventHandler(metadata: ConsumeEventMetadata) {
        // Subscribe to events for a domain, a schema and an action
        // Get event stream for a domain
        let events = this.messageBus.getEventsQueue(metadata.subscribeToDomain || this.domain.name);
        // Filtered by schema
        if (metadata.subscribeToSchema !== '*') {
            events = events.filter(e => e.schema === metadata.subscribeToSchema);
        }
        // Filtered by action
        if (metadata.subscribeToAction !== '*') {
            events = events.filter(e => e.action === metadata.subscribeToAction);
        }
        // And by custom filter
        if (metadata.filter)
            events = metadata.filter(events);

        events.subscribe(async (evt: EventData) => {
            let handlers = CommandManager.eventHandlersFactory.getFilteredHandlers(evt.domain, evt.schema, evt.action);
            for (let info of handlers) {
                let handler;
                let ctx = new RequestContext(this.container, Pipeline.EventNotification, evt);
                try {
                    try {
                        ctx.setSecurityManager(evt.userContext);// TODO + metrics
                        handler = ctx.container.resolve(info.handler);
                        handler.requestContext = ctx;
                        handler.event = evt;
                    }
                    catch (e) {
                        System.log.error(ctx, e, () => `Unable to create handler ${info.handler.name}`);
                        continue;
                    }

                    try {
                        await handler[info.methodName](evt.value);
                        this.sendCustomEvent(ctx);
                    }
                    catch (e) {
                        let error = (e instanceof CommandRuntimeError) ? e.error.toString() : (e.message || e.toString());
                        System.log.error(ctx, error, () => `Error with event handler ${info.handler.name} event : ${evt}`);
                    }
                }
                finally {
                    ctx.dispose();
                }
            }
        });
    }
}
