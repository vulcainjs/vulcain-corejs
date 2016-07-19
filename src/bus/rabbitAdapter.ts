import * as amqp from 'amqplib';
import {EventData, CommandData} from '../pipeline/commands';

export /**
 * RabbitAdapter
 */
class RabbitAdapter {
    private channel: amqp.Channel;
    private initialized = false;

    constructor(private address: string) {
        if (!address.startsWith("amqp://"))
            this.address = "amqp://" + address;
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


            self.initialized = true;
            amqp.connect(this.address).then((conn: amqp.Connection) => {
                conn.createChannel().then((ch: amqp.Channel) => {
                    self.channel = ch;
                    resolve(self);
                });
            });
        });
    }

    sendEvent(domain:string, event:EventData) {
        if (!this.channel) throw "error";
        domain = domain.toLowerCase() + "_events";

        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.publish(domain, '', new Buffer(JSON.stringify(event)));
    }

    listenForEvent(domain: string, handler: Function) {
        domain = domain.toLowerCase() + "_events";
        this.channel.assertExchange(domain, 'fanout', { durable: false });
        this.channel.assertQueue('', { exclusive: true }).then(queue => {
            this.channel.bindQueue(queue.queue, domain, '');
            this.channel.consume(queue.queue, async (msg) => {
                await handler(JSON.parse(msg.content.toString()));
            }, { noAck: true });
        });
    }

    publishTask(domain:string, serviceId:string, command:CommandData) {
        if (!this.channel) throw "error";
        domain = domain.toLowerCase();

        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.publish(domain, serviceId, new Buffer(JSON.stringify(command)), {persistent:true});
    }

    listenForTask(domain: string, serviceId: string, handler: Function) {
        domain = domain.toLowerCase();
        this.channel.assertExchange(domain, 'direct', { durable: false });
        this.channel.assertQueue(domain, {durable:true }).then(queue => {
            this.channel.bindQueue(queue.queue, domain, serviceId);
            this.channel.prefetch(1);

            this.channel.consume(queue.queue, async (msg) => {
                await handler(JSON.parse(msg.content.toString()));
                this.channel.ack(msg);
            }, { noAck: false });
        });
    }
}