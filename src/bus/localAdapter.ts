import {EventData, CommandData} from '../pipeline/commands';

export
class LocalAdapter {
    private eventHandler: Function;
    private commandHandler: Function;

    startAsync() {
        return Promise.resolve(this);
    }

    sendEvent(domain:string, event:EventData) {
       let self = this;
        setTimeout(function () {
            self.eventHandler(event);
        }, (10));
    }

    listenForEvent(domain: string, handler: Function) {
        this.eventHandler = handler;
    }

    publishTask(domain:string, serviceId:string, command:CommandData) {
       let self = this;
        setTimeout(function () {
            self.commandHandler(command);
        }, (10));
    }

    listenForTask(domain: string, serviceId: string, handler: Function) {
        this.commandHandler = handler;
    }
}