import { MessageBus, EventNotificationMode, ConsumeEventDefinition, EventData } from '../../../bus/messageBus';
import { IContainer } from '../../../di/resolvers';
import { Domain } from '../../../schemas/domain';
import { DefaultServiceNames } from '../../../di/annotations';
import { ServiceDescriptors, Handler } from '../descriptions/serviceDescriptions';
import { Service } from '../../../globals/system';
import { RequestContext } from "../../../pipeline/requestContext";
import { RequestData, Pipeline, ICustomEvent } from "../../../pipeline/common";
import { CommandRuntimeError } from "../../errors/commandRuntimeError";
import { UserContextData } from "../../../security/securityContext";
import { HttpResponse } from "../../response";
import { ApplicationError } from "../../errors/applicationRequestError";
import { BadRequestError } from "../../errors/badRequestError";
import { ITaskManager } from "../../../providers/taskManager";
import { IRequestContext, ExposeEventDefinition } from '../../../index';
import { HandlerProcessor } from '../../handlerProcessor';
import { EventHandlerFactory } from './eventHandlerFactory';
import { ActionDefinition } from './definitions';
import { IManager } from '../definitions';
import { Utils } from '../utils';

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

    private async validateRequestData(ctx: RequestContext, info:Handler, command: RequestData, skipValidation: boolean) {
        let errors;
        let inputSchema = info.definition.inputSchema;
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
            value: result && Utils.obfuscateSensibleData(this.domain, ctx.container, result),
            error: error && error.message,
            userContext: ctx.user.getUserContext(),
            status: status,
            domain: this._domain.name
        };
        return event;
    }

    async run(info: Handler, command: RequestData, ctx: RequestContext): Promise<HttpResponse> {

        let def = <ActionDefinition>info.definition;

        try {
            let skipValidation = def.skipDataValidation || (def.name === "delete" && def.skipDataValidation === undefined);
            let errors = await this.validateRequestData(ctx, info, command, skipValidation);
            if (errors && Object.keys(errors).length > 0) {
                throw new BadRequestError("Validation errors", errors);
            }

            command.schema = command.schema || <string>info.definition.schema;

            // Synchronous task
            if (!def.async) {

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
                let resultRaw = await info.handler[info.methodName](command.params);
                let result = resultRaw && Utils.obfuscateSensibleData(this.domain, this.container, resultRaw);

                if (!(result instanceof HttpResponse)) {
                    let res: ActionResult = {
                        value: result,
                    };
                    result = new HttpResponse(res);
                }

                let error = result.statusCode !== 200 ? new Error("Http error  " + result.statusCode) : null;
                this.emitEvent("TASK", ctx, def, resultRaw, error);
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

    private emitEvent(source: "EVENT"|"TASK", ctx: RequestContext, def: ActionDefinition, result, error?: Error) {
        let eventDef: ExposeEventDefinition = def.eventDefinition;
        if (!eventDef) {
            if (source === "EVENT")
                return null;    
            eventDef = {};
        }
        eventDef.mode = eventDef.mode || EventNotificationMode.successOnly;

        if ((eventDef.mode === EventNotificationMode.successOnly && !error) || eventDef.mode === EventNotificationMode.always) {
            let event = this.createEvent(ctx, error ? "Error" : "Success", result, error);
            event.completedAt = Service.nowAsString();
            
            if (eventDef.factory)
                event = eventDef.factory(ctx, event);
            
            // Redispatch event in EVENT mode only if this is a new event schema
            if (event && (source !== "EVENT" || (eventDef.schema && eventDef.schema !== (def.outputSchema || def.schema)))) {
                ctx.logInfo(() => `Send event ${eventDef.schema}`);
                this.messageBus.sendEvent(event);
            }
            
            return event;
        }
    }

    async processAsyncTask(command: AsyncTaskData) {
        let ctx = new RequestContext(this.container, Pipeline.AsyncTask, command);
        ctx.setSecurityManager(command.userContext);

        let processor =  this.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
        let info = processor.getHandlerInfo(ctx.container, command.schema, command.action);
        if (!info || info.kind !== "event") {
            ctx.logError(new ApplicationError(`no handler method founded for event ${ctx.requestData.vulcainVerb}`));
            ctx.dispose();
            return;
        }

        let def = <ActionDefinition>info.definition;

        let taskManager = this.container.get<ITaskManager>(DefaultServiceNames.TaskManager, true);
        try {
            let res;
            command.status = "Running";
            command.startedAt = Service.nowAsString();

            if (taskManager)
                await taskManager.updateTask(command);

            ctx.requestTracker.trackAction(command.vulcainVerb);
            info.handler.context = ctx;
            let result = await info.handler[info.methodName](command.params);

            if (result instanceof HttpResponse) {
                throw new Error("Custom Http Response is not valid in an async action");
            }

            this.emitEvent("TASK", ctx, def, result && Utils.obfuscateSensibleData(this.domain, this.container, result));
            command.status = "Success";
        }
        catch (e) {
            let error = (e instanceof CommandRuntimeError && e.error) ? e.error : e;
            this.emitEvent("TASK", ctx, def, null, error);
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
                this.bindEventHandler(<ConsumeEventDefinition>item.definition);
            }
        }
    }

    /**
     *
     */
    private bindEventHandler(def: ConsumeEventDefinition) {
        // Subscribe to events for a domain, a schema and an action
        // Get event stream for a domain
        let events = this.messageBus.getOrCreateEventQueue(def.subscribeToDomain || this.domain.name, def.distributionMode === "once" ? def.distributionKey: null);
        events = events.filter(e => !e[MessageBus.LocalEventSymbol]); // already sent ?

        // Filtered by schema
        if (def.subscribeToSchema !== '*') {
            events = events.filter(e => e.schema === def.subscribeToSchema);
        }
        // Filtered by action
        if (def.subscribeToAction !== '*') {
            events = events.filter(e => !e.action ||  (e.action.toLowerCase() === def.subscribeToAction));
        }
        // And by custom filter
        if (def.filter)
            events = def.filter(events);

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

                    let error;
                    try {
                        let res = await handler[info.methodName](evt.value);
                        if (res !== undefined)
                            evt.value = res;    
                    }
                    catch (e) {
                        error = (e instanceof CommandRuntimeError && e.error) ? e.error : e;
                        ctx.logError(error, () => `Error with event handler ${info.handler.name} event : ${evt}`);
                    }

                    let e = this.emitEvent("EVENT", ctx, def, evt.value, error);                        
                    MessageBus.emitLocalEvent(def.name, e);
                }
                finally {
                    ctx.dispose();
                }
            }
        });
    }
}
