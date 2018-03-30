import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';
import { EventData } from "./messageBus";
import { RequestData } from "../pipeline/common";
import * as RX from 'rxjs';

export
class LocalAdapter implements IActionBusAdapter, IEventBusAdapter {
    private eventQueue: RX.Subject<EventData>;
    private taskQueue: RX.Subject<RequestData>;

    open() {
        this.eventQueue = new RX.Subject<EventData>();
        this.taskQueue = new RX.Subject<RequestData>();
        return Promise.resolve();
    }

    stopReception() {   
        this.eventQueue = null;
        this.taskQueue = null;
    }

    sendEvent(domain: string, event: EventData) {
        this.eventQueue && this.eventQueue.next(event);
    }

    consumeEvents(domain: string, handler: (event: EventData) => void, queueName?: string) {
        this.eventQueue && this.eventQueue.subscribe(handler);
    }

    publishTask(domain: string, serviceId: string, command: RequestData) {
        this.taskQueue && this.taskQueue.next(command);
    }

    consumeTask(domain: string, serviceId: string, handler: (event: RequestData) => void) {
        this.taskQueue && this.taskQueue.subscribe(handler);
    }
}