import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';
import { EventData } from "../pipeline/handlers/messageBus";
import { RequestData } from "../pipeline/common";

export
class LocalAdapter implements IActionBusAdapter, IEventBusAdapter {
    private eventHandler: (event: EventData) => void;
    private commandHandler:  (event: RequestData) => void;

    open() {
        return Promise.resolve();
    }

    stopReception() { }

    sendEvent(domain: string, event: EventData) {
        // console.log("Event: %j", event);
        let self = this;
        self.eventHandler && setTimeout(function () {
            self.eventHandler(event);
        }, (1));
    }

    consumeEvents(domain: string, handler: (event: EventData) => void) {
        this.eventHandler = handler;
    }

    publishTask(domain: string, serviceId: string, command: RequestData) {
        let self = this;
        self.commandHandler && setTimeout(function () {
            // console.log("Running task: %j", command);
            self.commandHandler(command);
        }, (1));
    }

    consumeTask(domain: string, serviceId: string, handler: (event: RequestData) => void) {
        this.commandHandler = handler;
    }
}