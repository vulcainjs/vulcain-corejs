import { CommandManager, AsyncTaskData } from './actions';
import {IActionBusAdapter, IEventBusAdapter} from '../../bus/busAdapter';
import {DefaultServiceNames} from '../../di/annotations';
import * as RX from 'rxjs';
import { System } from '../../globals/system';
import { RequestData } from "../../pipeline/common";
import { RequestContext } from "../../pipeline/requestContext";
import { CommonMetadata } from "./common";
import { UserContextData } from "../../security/securityContext";

export interface EventData extends RequestData {
    value?: any;
    // Source service name
    source: string;
    error: string;
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

    public getEventsQueue(domain:string): RX.Observable<EventData> {
        let events = this._events.get(domain);
        if (!events) {
            events = new RX.Subject<EventData>();
            this._events.set(domain, events);
            this.eventBus.consumeEvents(domain, this.consumeEventAsync.bind(this));
        }
        return <RX.Observable<EventData>>events;
    }

    constructor(private manager: CommandManager, hasAsyncActions:boolean) {
        this.commandBus = manager.container.get<IActionBusAdapter>(DefaultServiceNames.ActionBusAdapter);
        if ( this.commandBus && hasAsyncActions ) // Register for async tasks only if necessary
        {
            this.commandBus.consumeTask(manager.domain.name, System.fullServiceName, manager.processAsyncTaskAsync.bind(manager));
        }

        this.eventBus = manager.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter);
    }

    private consumeEventAsync(event: EventData) {
        try {
            (<RX.Subject<EventData>>this.getEventsQueue(event.domain)).next(event);
        }
        catch (e) {
            System.log.error(
                null,
                e,
                ()=>`Consume event action: ${event.action} ${event.schema ? "schema: " + event.schema : ""} tenant: ${event.userContext.tenant}`
            );
        }
    }

    pushTask(command: AsyncTaskData) {
        command.status = "Pending";
        command.taskId = RequestContext.createUniqueId();
        this.commandBus && this.commandBus.publishTask(command.domain, System.fullServiceName, command);
    }

    sendEvent(event: EventData) {
        event.inputSchema = null;
        (<any>event).eventId = RequestContext.createUniqueId();
        this.eventBus.sendEvent(event.domain, event);
    }
}
