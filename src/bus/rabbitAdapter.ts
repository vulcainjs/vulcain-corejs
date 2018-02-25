import * as amqp from 'amqplib';
import { Service } from './../globals/system';
import { IActionBusAdapter, IEventBusAdapter } from '../bus/busAdapter';
import { EventData } from "./messageBus";
import { RequestData } from "../pipeline/common";
import { CryptoHelper } from '../utils/crypto';

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

    open() {
        let self = this;
        return new Promise<void>((resolve, reject) => {
            if (self.initialized)
            {
                return resolve();
            }

            self.initialized = true;
            Service.log.info(null, ()=>"Open rabbitmq connection on " + Service.removePasswordFromUrl(this.address));

            amqp.connect(this.address).then((conn: amqp.Connection) => {
                conn.createChannel().then((ch: amqp.Channel) => {
                    self.channel = ch;
                    resolve();
                });
            })
            .catch(err => {
                Service.log.error(null, err, ()=>`Unable to open rabbit connection.`);
                reject();
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
        this.eventHandlers.forEach(eh => { this.channel.unbindQueue(eh.queue, eh.domain, eh.args); });
        this.eventHandlers.clear();
    }

    dispose() {
        this.stopReception();
        this.channel.close();
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
        domain = this.createSourceName(domain);

        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.publish(domain, '', new Buffer(JSON.stringify(event)));
    }

    private createSourceName(domain: string) {
        return "vulcain_" + domain.toLowerCase() + "_events";
    }

    private createEventQueueName(domain: string, key?: string)
    {
        if (!key)
            return '';

        // Create an unique by service + handler queue name
        // domain, service, version + hash
        return ["vulcain", domain.toLowerCase(), Service.fullServiceName, CryptoHelper.hash(key)].join('_');
    }

    /**
     * Listening for domain events
     *
     * @param {string} domain
     * @param {Function} handler
     * @param {string} queuename
     *
     * If queuename is set, event are take into account by only one instance and a ack is send if the process complete sucessfully
     * else event is distributed to every instance with no ack
     */
    consumeEvents(domain: string, handler:  (event: EventData) => void, distributionKey?:string) {
        if (!this.channel)
            return;
        let self = this;

        const queueName = this.createEventQueueName(domain, distributionKey);

        // Since this method can be called many times for a same domain
        // all handlers are aggregated on only one binding
        domain = this.createSourceName(domain);
        const handlerKey = domain + queueName;
        let handlerInfo = this.eventHandlers.get(handlerKey);
        if (handlerInfo) {
            handlerInfo.handlers.push(handler);
            return;
        }

        // First time for this domain, create the binding
        this.channel.assertExchange(domain, 'fanout', { durable: false });

        // For one event delivery:
        // specific queue and exclusive=false
        // else
        // empty queue name and exclusive=true
        let options = { exclusive: !queueName, autoDelete: !!queueName };
        this.channel.assertQueue(queueName, options).then(queue => {
            const handlers = [handler];
            this.eventHandlers.set(handlerKey, {queue: queue.queue, domain, handlers, args: ''});

            self.channel.bindQueue(queue.queue, domain, '');
            self.channel.consume(queue.queue, async (msg) => {
                if (this.ignoreInputMessages) return;
                let obj = JSON.parse(msg.content.toString());

                let handlerInfo = self.eventHandlers.get(handlerKey);
                try {
                    if (handlerInfo) {
                        let tasks = handlerInfo.handlers.map(h => h(obj));
                        if (queueName) {
                            await Promise.all(tasks);
                            self.channel.ack(msg);
                        }
                    }
                }
                catch (e) {
                    Service.log.error(null, e, () => "Event handler failed for event " + obj.metadata.eventId);
                }
            }, { noAck: !queueName });
        });
    }

    /**
     * Task = asynchronous action
     * Shared by the current service instances
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