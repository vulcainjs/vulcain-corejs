import { System } from 'vulcain-configurationsjs';
import * as amqp from 'amqplib';
import {EventData, ActionData} from '../pipeline/actions';

export /**
 * RabbitAdapter
 */
class RabbitAdapter {
    private channel: amqp.Channel;
    private initialized = false;

    constructor(private address: string) {
        if (!address.startsWith("amqp://"))
            this.address = "amqp://" + address;
        this.address += "/" + System.environment;
    }

    startAsync() {
        if (!this.address)
            throw new Error("Address is required for RabbitAdapter");

        let self = this;
        return new Promise((resolve, reject) => {
            if (self.initialized)
            {
                return resolve(self);
            }

            // TODO connection error
            self.initialized = true;
            amqp.connect(this.address).then((conn: amqp.Connection) => {
                conn.createChannel().then((ch: amqp.Channel) => {
                    self.channel = ch;
                    resolve(self);
                });
            });
        });
    }

    /**
     * Send domain event (event raises by an action)
     * Domain events are shared by all services belonging to any domains
     *
     * @param {string} domain
     * @param {EventData} event
     *
     * @memberOf RabbitAdapter
     */
    sendEvent(domain:string, event:EventData) {
        if (!this.channel) throw "error";
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
    listenForEvent(domain: string, handler: Function) {
        let self = this;
        domain = domain.toLowerCase() + "_events";
        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.assertQueue('', { exclusive: true }).then(queue => {
            self.channel.bindQueue(queue.queue, domain, '');
            self.channel.consume(queue.queue, async (msg) => {
                await handler(JSON.parse(msg.content.toString()));
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
        if (!this.channel) throw "error";
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
    listenForTask(domain: string, serviceId: string, handler: Function) {
        let self = this;
        domain = domain.toLowerCase();
        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.assertQueue(domain, {durable:true }).then(queue => {
            self.channel.bindQueue(queue.queue, domain, serviceId);
            self.channel.prefetch(1);

            self.channel.consume(queue.queue, async (msg) => {
                await handler(JSON.parse(msg.content.toString()));
                self.channel.ack(msg);
            }, { noAck: false });
        });
    }
}