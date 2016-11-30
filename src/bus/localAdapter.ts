import { EventData, ActionData } from '../pipeline/actions';
import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';

export
class LocalAdapter implements IActionBusAdapter, IEventBusAdapter {
    private eventHandler: Function;
    private commandHandler: Function;

    startAsync() {
        return Promise.resolve(this);
    }

    sendEvent(domain: string, event: EventData) {
        // console.log("Event: %j", event);
        let self = this;
        self.eventHandler && setTimeout(function () {
            self.eventHandler(event);
        }, (1));
    }

    listenEvents(domain: string, handler: Function) {
        this.eventHandler = handler;
    }

    publishTask(domain: string, serviceId: string, command: ActionData) {
        let self = this;
        self.commandHandler && setTimeout(function () {
            // console.log("Running task: %j", command);
            self.commandHandler(command);
        }, (1));
    }

    listenTasks(domain: string, serviceId: string, handler: Function) {
        this.commandHandler = handler;
    }
}