import {EventData, ActionData} from '../pipeline/actions';

/**
 * Async actions dispatcher
 * Connect only instances of a same service
 *
 * @export
 * @interface IActionBusAdapter
 */
export interface IActionBusAdapter {
    /**
     * Start a new topic
     *
     *
     * @memberOf IActionBusAdapter
     */
    startAsync();
    /**
     * Publish an async action
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {ActionData} command
     *
     * @memberOf IActionBusAdapter
     */
    publishTask(domain: string, serviceId: string, command: ActionData);
    /**
     * Consume an async action
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {Function} handler
     *
     * @memberOf IActionBusAdapter
     */
    consumeTask(domain: string, serviceId: string, handler: Function);
}

/**
 * Global event bus
 *
 * @export
 * @interface IEventBusAdapter
 */
export interface IEventBusAdapter {
    startAsync();
    sendEvent(domain: string, event: EventData);
    consumeEvents(domain: string, handler: Function);
}