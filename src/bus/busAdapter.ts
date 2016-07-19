import {EventData, CommandData} from '../pipeline/commands';

export interface ICommandBusAdapter {
    startAsync();
    publishTask(domain: string, serviceId: string, command: CommandData);
    listenForTask(domain: string, serviceId: string, handler: Function);
}

export interface IEventBusAdapter {
    startAsync();
    sendEvent(domain: string, event: EventData);
    listenForEvent(domain: string, handler: Function);
}