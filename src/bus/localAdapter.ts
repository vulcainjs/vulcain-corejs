import {EventData, ActionData} from '../pipeline/actions';

export
class LocalAdapter {
    private eventHandler: Function;
    private commandHandler: Function;

    startAsync() {
        return Promise.resolve(this);
    }

    sendEvent(domain: string, event: EventData) {
        console.log("Event: %j", event);
       let self = this;
        self.eventHandler && setTimeout(function () {
            self.eventHandler(event);
        }, (10));
    }

    listenForEvent(domain: string, handler: Function) {
        this.eventHandler = handler;
    }

    publishTask(domain:string, serviceId:string, command:ActionData) {
        let self = this;
        self.commandHandler && setTimeout(function () {
            console.log("Running task: %j", command);
            self.commandHandler(command);
        }, (10));
    }

    listenForTask(domain: string, serviceId: string, handler: Function) {
        this.commandHandler = handler;
    }
}