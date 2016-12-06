import {ActionData, ActionResponse, CommandManager, EventData} from './actions';
const guid = require('uuid');
import {IActionBusAdapter, IEventBusAdapter} from '../bus/busAdapter';
import {DefaultServiceNames} from '../di/annotations';
import * as RX from 'rx';

export class MessageBus {
    private commandBus: IActionBusAdapter;
    private eventBus: IEventBusAdapter;
    private _events: Map<string,RX.Subject<EventData>> = new Map<string, RX.Subject<EventData>>();

    public getEventsQueue(domain:string): RX.Observable<EventData> {
        let events = this._events.get(domain);
        if (!events) {
            events = new RX.Subject<EventData>();
            this._events.set(domain, events);
            this.eventBus.listenEvents(domain, this.consumeEventAsync.bind(this));
        }
        return events;
    }

    constructor(private manager: CommandManager, hasAsyncActions:boolean) {
        this.commandBus = manager.container.get<IActionBusAdapter>(DefaultServiceNames.ActionBusAdapter);
        if (this.commandBus && hasAsyncActions) // Register for async tasks only if necessary
        {
            this.commandBus.listenTasks(manager.domain.name, manager.serviceId, manager.consumeTaskAsync.bind(manager));
        }

        this.eventBus = manager.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter);
    }

    private consumeEventAsync(event: EventData) {
        (<RX.Subject<EventData>>this.getEventsQueue(event.domain)).onNext(event);
    }

    pushTask(command: ActionData) {
        command.status = "Pending";
        command.taskId = guid.v4();
        this.commandBus.publishTask(command.domain, this.manager.serviceId, command);
    }

    sendEvent(response: ActionResponse<any>) {
        delete response.inputSchema;
        this.eventBus.sendEvent(response.domain, response);
    }
}
