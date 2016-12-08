import {EventData, ActionData} from '../pipeline/actions';

export interface IActionBusAdapter {
    startAsync();
    publishTask(domain: string, serviceId: string, command: ActionData);
    consumeTask(domain: string, serviceId: string, handler: Function);
}

export interface IEventBusAdapter {
    startAsync();
    sendEvent(domain: string, event: EventData);
    consumeEvents(domain: string, handler: Function);
}