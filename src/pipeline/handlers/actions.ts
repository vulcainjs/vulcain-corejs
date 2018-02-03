import { MessageBus, EventNotificationMode, ConsumeEventMetadata, EventData } from './messageBus';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/domain';
import { DefaultServiceNames } from '../../di/annotations';
import { HandlerFactory, CommonActionMetadata, IManager, ServiceHandlerMetadata } from './common';
import { EventHandlerFactory } from './eventHandlerFactory';
import { ServiceDescriptors, HandlerInfo } from './serviceDescriptions';
import { Service } from '../../globals/system';
import { RequestContext } from "../../pipeline/requestContext";
import { RequestData, Pipeline, ICustomEvent } from "../../pipeline/common";
import { CommandRuntimeError } from "../errors/commandRuntimeError";
import { UserContextData } from "../../security/securityContext";
import { HttpResponse } from "../response";
import { ApplicationError } from "../errors/applicationRequestError";
import { BadRequestError } from "../errors/badRequestError";
import { ITaskManager } from "../../providers/taskManager";
import { IRequestContext } from '../../index';
import { HandlerProcessor } from '../handlerProcessor';

export interface AsyncTaskData extends RequestData {
    status?: "Error" | "Success" | "Pending" | "Running";
    taskId?: string;
    submitAt?: string;
    startedAt?: string;
    userContext?: UserContextData;
    completedAt?: string;
}

export interface ActionResult {
    value?:any;
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
    skipDataValidation?: boolean;
    async?: boolean;
    eventMode?: EventNotificationMode;
    eventFactory?: (context: IRequestContext, event: EventData) => EventData;
    eventOptions?: any;
}

export class CommandManager implements IManager {
    private messageBus: MessageBus;
    private _domain: Domain;
    private _initialized = false;

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

    private async validateRequestData(ctx: RequestContext, info:any, command: RequestData, skipValidation: boolean) {
        let errors;
        let inputSchema = info.metadata.inputSchema;
        if (inputSchema && inputSchema !== "none") {
            let schema = inputSchema && this.domain.getSchema(inputSchema);
            if (schema) {
                command.inputSchema = schema.name;

                // Custom binding if any
                try {
                    command.params = schema && schema.coerce(command.params);
                }
                catch (ex) {
                    if (!skipValidation) {
                        return [{ message: "Binding error : " + ex.message }];
                    }
                }
                if (!skipValidation) {
                    errors = await schema.validate(ctx, command.params);
                }
            }

            if (!skipValidation && !errors) {
                // Search if a method naming validate<schema> exists
                let methodName = 'validate' + inputSchema;
                errors = info.handler[methodName] && await info.handler[methodName](command.params, command.action);
            }
        }

        return errors;
    }

    private createEvent(ctx: RequestContext, status: "Error" | "Pending" | "Success", result:any, error?:Error): EventData {
        let event: EventData = {
            vulcainVerb: `${ctx.requestData.schema}.${ctx.requestData.action}`,
            correlationId: ctx.requestData.correlationId,
            action: ctx.requestData.action,
            schema: ctx.requestData.schema,
            source: Service.fullServiceName,
            startedAt: Service.nowAsString(),
            value: result && HandlerFactory.obfuscateSensibleData(this.domain, ctx.container, result),
            error: error && error.message,
            userContext: ctx.user.getUserContext(),
            status: status,
            domain: this._domain.name
        };
        return event;
    }

    async run(info: HandlerInfo, command: RequestData, ctx: RequestContext): Promise<HttpResponse> {

        let metadata = <ActionMetadata>info.metadata;
        let eventMode = metadata.eventMode || EventNotificationMode.successOnly;

        try {
            let skipValidation = metadata.skipDataValidation || (metadata.action === "delete" && metadata.skipDataValidation === undefined);
            let errors = await this.validateRequestData(ctx, info, command, skipValidation);
            if (errors && Object.keys(errors).length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            command.schema = command.schema || <string>info.metadata.schema;

            // Synchronous task
            if (!metadata.async) {

                info.handler.context = ctx;
                /** // Inject runTask in the current context
                (<any>ctx)._runTask = (action, schema, params) => {
                    let task = <RequestData>{ action, schema, params };
                    task.correlationId = ctx.correlationId;
                    task.startedAt = System.nowAsString();
                    task.service = this._serviceId;
                    task.userContext = task.userContext || command.userContext;
                    this.messageBus.pushTask(task);
                    };
                **/
                let resultRaw = await info.handler[info.method](command.params);
                let result = resultRaw && HandlerFactory.obfuscateSensibleData(this.domain, this.container, resultRaw);

                if (!(result instanceof HttpResponse)) {
                    let res: ActionResult = {
                        value: result,
                    };
                    result = new HttpResponse(res);
                }

                if ((eventMode === EventNotificationMode.successOnly && result.statusCode === 200) || eventMode === EventNotificationMode.always) {
                    let event = this.createEvent(ctx, "Success", resultRaw);
                    if (metadata.eventFactory)
                        event = metadata.eventFactory(ctx, event);
                    if(event)
                        this.messageBus.sendEvent(event);
                }

                this.sendCustomEvent(ctx);

                return result;
            }
            else {
                // Asynchronous task
                let pendingTask: AsyncTaskData = Object.assign({}, ctx.getRequestDataObject(), {
                    submitAt: Service.nowAsString(),
                    status: "Pending"
                });

                pendingTask.userContext = ctx.user.getUserContext();
                this.messageBus.pushTask(pendingTask);

                let taskManager = this.container.get<ITaskManager>(DefaultServiceNames.TaskManager, true);
                if (taskManager)
                    await taskManager.registerTask(pendingTask);

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
            let error = (e instanceof CommandRuntimeError && e.error) ? e.error : e;
            throw error;
        }
    } 

    async processAsyncTask(command: AsyncTaskData) {
        let ctx = new RequestContext(this.container, Pipeline.AsyncTask, command);
        ctx.setSecurityManager(command.userContext);

        let processor =  this.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
        let info = processor.getHandlerInfo(ctx.container, command.schema, command.action);
        if (!info || info.kind !== "event") {
            Service.log.error(ctx, new ApplicationError(`no handler method founded for event ${ctx.requestData.vulcainVerb}`));
            ctx.dispose();
            return;
        }

        let metadata = <ActionMetadata>info.metadata;
        let eventMode = metadata.eventMode || EventNotificationMode.always;

        let taskManager = this.container.get<ITaskManager>(DefaultServiceNames.TaskManager, true);
        try {
            let res;
            command.status = "Running";
            command.startedAt = Service.nowAsString();

            if (taskManager)
                await taskManager.updateTask(command);

            ctx.requestTracker.trackAction(command.vulcainVerb);
            info.handler.context = ctx;
            let result = await info.handler[info.method](command.params);

            if (result instanceof HttpResponse) {
                throw new Error("Custom Http Response is not valid in an async action");
            }
            if (eventMode === EventNotificationMode.always || eventMode === EventNotificationMode.successOnly) {
                result = result && HandlerFactory.obfuscateSensibleData(this.domain, this.container, result);
                let event = this.createEvent(ctx, "Success", result);
                event.completedAt = Service.nowAsString();
                if (metadata.eventFactory)
                    event = metadata.eventFactory(ctx, event);
                if(event)
                    this.messageBus.sendEvent(event);
            }
            this.sendCustomEvent(ctx);
            command.status = "Success";
        }
        catch (e) {
            if (eventMode === EventNotificationMode.always) {
                let error = (e instanceof CommandRuntimeError && e.error) ? e.error : e;
                let event = this.createEvent(ctx, "Error", null, error);
                event.completedAt = Service.nowAsString();
                if (metadata.eventFactory)
                    event = metadata.eventFactory(ctx, event);
                if(event)
                    this.messageBus.sendEvent(event);
            }
            ctx.logError( e, () => `Error when processing async action : ${JSON.stringify(command)}`);
            command.status = "Error";
        }
        finally {
            command.completedAt = Service.nowAsString();
            if (taskManager)
                await taskManager.updateTask(command);
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
        let events = this.messageBus.getEventQueue(metadata.subscribeToDomain || this.domain.name, metadata.distributionMode === "once" ? metadata.distributionKey: null);

        // Filtered by schema
        if (metadata.subscribeToSchema !== '*') {
            events = events.filter(e => e.schema === metadata.subscribeToSchema);
        }
        // Filtered by action
        if (metadata.subscribeToAction !== '*') {
            events = events.filter(e => !e.action ||  (e.action.toLowerCase() === metadata.subscribeToAction));
        }
        // And by custom filter
        if (metadata.filter)
            events = metadata.filter(events);

        events.subscribe(async (evt: EventData) => {
            let handlers = CommandManager.eventHandlersFactory.getFilteredHandlers(evt.domain, evt.schema, evt.action);
            for (let info of handlers) {
                let handler;
                let ctx = new RequestContext(this.container, Pipeline.Event, evt);
                try {
                    try {
                        ctx.requestTracker.trackAction(evt.vulcainVerb);
                        ctx.setSecurityManager(evt.userContext);
                        handler = ctx.container.resolve(info.handler);
                        handler.context = ctx;
                        handler.event = evt;
                    }
                    catch (e) {
                        ctx.logError(e, () => `Unable to create handler ${info.handler.name}`);
                        continue;
                    }

                    try {
                        await handler[info.methodName](evt.value);
                        this.sendCustomEvent(ctx);
                    }
                    catch (e) {
                        let error = (e instanceof CommandRuntimeError && e.error) ? e.error.toString() : (e.message || e.toString());
                        ctx.logError(error, () => `Error with event handler ${info.handler.name} event : ${evt}`);
                    }
                }
                finally {
                    ctx.dispose();
                }
            }
        });
    }
}
