// Entry point
import {DefaultServiceNames, RabbitAdapter, Application, Conventions} from '../index';

class MyApplication extends Application {
    initializeServices() {
        this.useRabbitAdapter('amqp://192.168.99.100');
    }
}

Conventions.defaultApplicationFolder = "samples";

let app = new MyApplication("customer");
app.start(8080);
