
export
class LocalAdapter {
    private eventHandler: Function;
    private commandHandler: Function;

    startAsync() {
        return Promise.resolve(this);
    }

    sendEvent(domain:string, message:string) {
       let self = this;
        setTimeout(function () {
            self.eventHandler(JSON.parse(message));
        }, (10));
    }

    listenForEvent(domain: string, handler: Function) {
        this.eventHandler = handler;
    }

    publishTask(domain:string, serviceId:string, message:string) {
       let self = this;
        setTimeout(function () {
            self.commandHandler(JSON.parse(message));
        }, (10));
    }

    listenForTask(domain: string, serviceId: string, handler: Function) {
        this.commandHandler = handler;
    }
}