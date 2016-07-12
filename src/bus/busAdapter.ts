export interface ICommandBusAdapter {
    startAsync();
    publishTask(domain: string, serviceId: string, message: string);
    listenForTask(domain: string, serviceId: string, handler: Function);
}

export interface IEventBusAdapter {
    startAsync();
    sendEvent(domain: string, message: string);
    listenForEvent(domain: string, handler: Function);
}