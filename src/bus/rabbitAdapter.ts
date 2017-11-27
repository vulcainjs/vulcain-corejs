import * as amqp from 'amqplib';
import { System } from './../globals/system';
import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';
import { EventData } from "../pipeline/handlers/messageBus";
import { RequestData } from "../pipeline/common";

export /**
 * RabbitAdapter
 */
class RabbitAdapter implements IActionBusAdapter, IEventBusAdapter {
    private eventHandlers = new Map<string, { queue, domain: string, handlers: Function[], args: string }>();
    private channel: amqp.Channel;
    private initialized = false;
    private ignoreInputMessages = false;

    constructor(private address: string) {
        if (!this.address)
            throw new Error("Address is required for RabbitAdapter");

        if (!address.startsWith("amqp://"))
            this.address = "amqp://" + address;
    }

    start() {
        let self = this;
        return new Promise((resolve, reject) => {
            if (self.initialized)
            {
                return resolve(self);
            }

            // TODO connection error
            self.initialized = true;
            System.log.info(null, ()=>"Open rabbitmq connexion on " + System.removePasswordFromUrl(this.address)); // TODO remove password
            amqp.connect(this.address).then((conn: amqp.Connection) => {
                conn.createChannel().then((ch: amqp.Channel) => {
                    self.channel = ch;
                    resolve(self);
                });
            })
            .catch(err => {
                System.log.error(null, err, ()=>`Unable to open rabbit connexion. Verify if virtualHost ${System.environment} exists.`);
                resolve(self);
            });
        });
    }

    pauseReception() {
        this.ignoreInputMessages = true;
    }

    resumeReception() {
        this.ignoreInputMessages = false;
    }

    stopReception() {
        this.pauseReception();
        this.eventHandlers.forEach(eh => { this.channel.unbindQueue(eh.queue, eh.domain, eh.args) });
        this.eventHandlers.clear();
    }

    /**
     * Send domain event (event raises by an action)
     * Domain events are shared by all services of any domains
     *
     * @param {string} domain
     * @param {EventData} event
     *
     * @memberOf RabbitAdapter
     */
    sendEvent(domain:string, event:EventData) {
        if (!this.channel)
            return;
        domain = domain.toLowerCase() + "_events";

        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.publish(domain, '', new Buffer(JSON.stringify(event)));
    }

    /**
     * Listening for domain events
     *
     * @param {string} domain
     * @param {Function} handler
     *
     * @memberOf RabbitAdapter
     */
    consumeEvents(domain: string, handler:  (event: EventData) => void) {
        if (!this.channel)
            return;
        let self = this;

        // Since this method can be called many times for a same domain
        // all handlers are aggragated on only one binding
        domain = domain.toLowerCase() + "_events";
        let handlerInfo = this.eventHandlers.get(domain);
        if (handlerInfo) {
            handlerInfo.handlers.push(handler);
            return;
        }

        // First time for this domain, create the binding
        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.assertQueue('', { exclusive: true }).then(queue => {
            const handlers = [handler];
            this.eventHandlers.set(domain, {queue: queue.queue, domain, handlers, args: ''});

            self.channel.bindQueue(queue.queue, domain, '');
            self.channel.consume(queue.queue, async (msg) => {
                if (this.ignoreInputMessages) return;
                let obj = JSON.parse(msg.content.toString());

                let handlerInfo = self.eventHandlers.get(domain);
                handlerInfo && handlerInfo.handlers.forEach(h => h(obj));
            }, { noAck: true });
        });
    }

    /**
     * Task = asynchronous action
     * Shared by service instances
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {ActionData} command
     *
     * @memberOf RabbitAdapter
     */
    publishTask(domain:string, serviceId:string, command:RequestData) {
        if (!this.channel)
            return;
        domain = domain.toLowerCase();

        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.publish(domain, serviceId, new Buffer(JSON.stringify(command)), {persistent:true});
    }

    /**
     * Listening for asynchronous task
     *
     * @param {string} domain
     * @param {string} serviceId
     * @param {Function} handler
     *
     * @memberOf RabbitAdapter
     */
    consumeTask(domain: string, serviceId: string, handler:  (event: RequestData) => void) {
        if (!this.channel)
            return;

        let self = this;
        domain = domain.toLowerCase();

        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.assertQueue(domain, { durable: true }).then(queue => {
            this.eventHandlers.set("Async:" + domain, {queue: queue.queue, domain, handlers: [handler], args: serviceId});

            // Channel name = serviceId
            self.channel.bindQueue(queue.queue, domain, serviceId);
            self.channel.prefetch(1);

            self.channel.consume(queue.queue, async (msg) => {
                if (this.ignoreInputMessages) return;
                await handler(JSON.parse(msg.content.toString()));
                self.channel.ack(msg);
            }, { noAck: false });
        });
    }
}