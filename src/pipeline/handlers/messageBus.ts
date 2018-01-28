import { CommandManager, AsyncTaskData } from './actions';
import {IActionBusAdapter, IEventBusAdapter} from '../../bus/busAdapter';
import {DefaultServiceNames} from '../../di/annotations';
import * as RX from 'rxjs';
import { Service } from '../../globals/system';
import { RequestData } from "../../pipeline/common";
import { CommonMetadata } from "./common";
import { UserContextData } from "../../security/securityContext";
import { Conventions } from '../../utils/conventions';

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

export interface ConsumeEventMetadata {
    description: string;
    subscribeToDomain?: string;
    subscribeToAction?: string;
    subscribeToSchema?: string;
    filter?: (observable: RX.Observable<EventData>) => RX.Observable<EventData>;
    /**
     * Distribution mode: once or many (default)
     */
    distributionMode: "once" | "many";
    distributionKey?: string; // Unique queue to ensure events are take into account once
}

export interface EventMetadata extends CommonMetadata {
    subscribeToDomain?: string;
}

export enum EventNotificationMode {
    never,
    always,
    successOnly
}

export class MessageBus {
    private commandBus: IActionBusAdapter;
    private eventBus: IEventBusAdapter;
    private _events: Map<string,RX.Subject<EventData>> = new Map<string, RX.Subject<EventData>>();

    /**
     * Get event queue for a domain
     */
    public getEventQueue(domain: string, distributionKey: string): RX.Observable<EventData> {
        let events = this._events.get(domain);
        if (!events) {
            events = new RX.Subject<EventData>();
            this._events.set(domain, events);
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
            (<RX.Subject<EventData>>this.getEventQueue(event.domain, distributionKey)).next(event);
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
    }
}
