import { RequestData } from "../pipeline/common";
import { EventData } from "../pipeline/handlers/messageBus";

/**
 * Async actions dispatcher
 * Connect only instances of a same service
 *
 * @export
 * @interface IActionBusAdapter
 */
export interface IActionBusAdapter {
    /**
     * Open bus
     *
     */
    open(): Promise<void>;

    /**
     * Gracefully stop message consumption
     */
    stopReception();

    /**
     * Publish an async action
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {RequestData} command
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
 * Events are shared by all service instance.
 * Event is sent when action complete
 *
 * @export
 * @interface IEventBusAdapter
 */
export interface IEventBusAdapter {
    /**
     * Open bus
     */
    open();
    /**
     * Gracefully stop message consumption
     */
    stopReception();
    /**
     * send event
     */
    sendEvent(domain: string, event: EventData);
    /**
     * Consume events
     */
    consumeEvents(domain: string, handler: (event: EventData) => void, distributionKey?:string);
}