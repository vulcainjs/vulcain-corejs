import {EventData, ActionData} from '../pipeline/actions';

export interface ICommandBusAdapter {
    startAsync();
    publishTask(domain: string, serviceId: string, command: ActionData);
    listenForTask(domain: string, serviceId: string, handler: Function);
}

export interface IEventBusAdapter {
    startAsync();
    sendEvent(domain: string, event: EventData);
    listenForEvent(domain: string, handler: Function);
}