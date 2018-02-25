import { CommandManager, AsyncTaskData } from '../pipeline/handlers/action/actionManager';
import {IActionBusAdapter, IEventBusAdapter} from './busAdapter';
import {DefaultServiceNames} from './../di/annotations';
import * as RX from 'rxjs';
import { Service } from '../globals/system';
import { RequestData } from "./../pipeline/common";
import { UserContextData } from "../security/securityContext";
import { Conventions } from '../utils/conventions';
import { EventEmitter } from 'events';

export interface EventData extends RequestData {
    value?: any;
    // Source service name
    source: string;
    error?: string;
    userContext: UserContextData;
    startedAt: string;
    completedAt?: string;
    status: string;
}

export interface ConsumeEventDefinition {
    name?: string;
    description: string;
    subscribeToDomain?: string;
    subscribeToAction?: string;
    subscribeToSchema?: string;
    filter?: (observable: RX.Observable<EventData>) => RX.Observable<EventData>;
    /**
     * Distribution mode: once or many (default)
     */
    distributionMode?: "once" | "many"| undefined;
    distributionKey?: string; // Unique queue to ensure events are take into account once
    metadata?: any;
}

export interface EventDefinition {
    name?: string;
    description?: string;
    schema?: string;
    metadata?: any;
    subscribeToDomain?: string;
}

export enum EventNotificationMode {
    successOnly=1,
    never=2,
    always=3
}


export class MessageBus {
    public static readonly LocalEventSymbol = Symbol("local_event");

    private commandBus: IActionBusAdapter;
    private eventBus: IEventBusAdapter;
    private _eventQueuesByDomain: Map<string,RX.Subject<EventData>> = new Map<string, RX.Subject<EventData>>();
    private static _localEvents: RX.Subject<EventData>;

    public static get localEvents() {
        if (!MessageBus._localEvents) {
            MessageBus._localEvents = new RX.Subject<EventData>();
        }
        return MessageBus._localEvents;
    }

    public static emitLocalEvent(eventHandlerName: string, evt: EventData) {
        if (!MessageBus._localEvents || evt[MessageBus.LocalEventSymbol])  // Infinite loop guard
            return;

        evt[MessageBus.LocalEventSymbol] = eventHandlerName;
        MessageBus._localEvents.next(evt);
    }

    /**
     * Get event queue for a domain
     */
    public getOrCreateEventQueue(domain: string, distributionKey: string): RX.Observable<EventData> {
        let events = this._eventQueuesByDomain.get(domain);
        if (!events) {
            events = new RX.Subject<EventData>();
            this._eventQueuesByDomain.set(domain, events);
            this.eventBus.consumeEvents(domain, this.consumeEvent.bind(this), distributionKey);
        }
        return <RX.Observable<EventData>>events;
    }

    constructor(private manager: CommandManager, hasAsyncActions:boolean) {
        this.commandBus = manager.container.get<IActionBusAdapter>(DefaultServiceNames.ActionBusAdapter);
        if ( this.commandBus && hasAsyncActions ) // Register for async tasks only if necessary
        {
            this.commandBus.consumeTask(manager.domain.name, Service.fullServiceName, manager.processAsyncTask.bind(manager));
        }

        this.eventBus = manager.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter);
    }

    private consumeEvent(event: EventData, distributionKey:string) {
        try {
            (<RX.Subject<EventData>>this.getOrCreateEventQueue(event.domain, distributionKey)).next(event);
        }
        catch (e) {
            Service.log.error(
                null,
                e,
                ()=>`Consume event action: ${event.action} ${event.schema ? "schema: " + event.schema : ""} tenant: ${event.userContext.tenant}`
            );
        }
    }

    pushTask(command: AsyncTaskData) {
        command.status = "Pending";
        command.taskId = Conventions.getRandomId();
        this.commandBus && this.commandBus.publishTask(command.domain, Service.fullServiceName, command);
    }

    sendEvent(event: EventData) {
        event.inputSchema = null;
        (<any>event).eventId = Conventions.getRandomId();
        this.eventBus.sendEvent(event.domain, event);
        return event;
    }
}
