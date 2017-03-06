import * as amqp from 'amqplib';
import {EventData, ActionData} from '../pipeline/actions';
import { System } from './../configurations/globals/system';
import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';

export /**
 * RabbitAdapter
 */
class RabbitAdapter implements IActionBusAdapter, IEventBusAdapter {
    private domainHandlers = new Map<string, Function>();
    private channel: amqp.Channel;
    private initialized = false;

    constructor(private address: string) {
        if (!this.address)
            throw new Error("Address is required for RabbitAdapter");

        if (!address.startsWith("amqp://"))
            this.address = "amqp://" + address;
        this.address += "/" + System.environment;
    }

    startAsync() {
        let self = this;
        return new Promise((resolve, reject) => {
            if (self.initialized)
            {
                return resolve(self);
            }

            // TODO connection error
            self.initialized = true;
            System.log.info(null, "Open rabbitmq connexion on " + System.removePasswordFromUrl(this.address)); // TODO remove password
            amqp.connect(this.address).then((conn: amqp.Connection) => {
                conn.createChannel().then((ch: amqp.Channel) => {
                    self.channel = ch;
                    resolve(self);
                });
            })
            .catch(err => {
                System.log.error(null, err, `Unable to open rabbit connexion. Verify if virtualHost ${System.environment} exists.`);
                resolve(self);
            });
        });
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
    consumeEvents(domain: string, handler: Function) {
        if (!this.channel)
            return;
        let self = this;

        // Since this method can be called many times for a same domain
        // all handlers are aggragated on only one binding
        domain = domain.toLowerCase() + "_events";
        let handlers = this.domainHandlers.get[domain];
        if (handlers) {
            handlers.push(handler);
            return;
        }

        // First time for this domain, create the binding
        handlers = [handler];
        this.domainHandlers.set(domain, handlers);

        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.assertQueue('', { exclusive: true }).then(queue => {
            self.channel.bindQueue(queue.queue, domain, '');
            self.channel.consume(queue.queue, async (msg) => {
                let obj = JSON.parse(msg.content.toString());
                handlers.forEach(h=>h(obj));
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
    publishTask(domain:string, serviceId:string, command:ActionData) {
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
    consumeTask(domain: string, serviceId: string, handler: Function) {
        if (!this.channel)
            return;
        let self = this;
        domain = domain.toLowerCase();

        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.assertQueue(domain, { durable: true }).then(queue => {
            // Channel name = serviceId
            self.channel.bindQueue(queue.queue, domain, serviceId);
            self.channel.prefetch(1);

            self.channel.consume(queue.queue, async (msg) => {
                await handler(JSON.parse(msg.content.toString()));
                self.channel.ack(msg);
            }, { noAck: false });
        });
    }
}
