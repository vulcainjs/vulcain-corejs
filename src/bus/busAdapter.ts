
/**
 * Async actions dispatcher
 * Connect only instances of a same service
 *
 * @export
 * @interface IActionBusAdapter
 */
import { RequestData } from "../pipeline/common";
import { EventData } from "../pipeline/handlers/messageBus";

export interface IActionBusAdapter {
    /**
     * Start a new topic
     *
     *
     * @memberOf IActionBusAdapter
     */
    start();
    /**
     * Publish an async action
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {ActionData} command
     *
     * @memberOf IActionBusAdapter
     */
    publishTask(domain: string, serviceId: string, command: RequestData);
    /**
     * Consume an async action
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {Function} handler
     *
     * @memberOf IActionBusAdapter
     */
    consumeTask(domain: string, serviceId: string, handler:  (event: RequestData) => void);
}

/**
 * Global event bus
 *
 * @export
 * @interface IEventBusAdapter
 */
export interface IEventBusAdapter {
    start();
    sendEvent(domain: string, event: EventData);
    consumeEvents(domain: string, handler: (event: EventData) => void);
}