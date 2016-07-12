// Entry point
import {DefaultServiceNames, RabbitAdapter, Application} from '../index';

class MyApplication extends Application {
    initializeServices() {
        this.useRabbitAdapter('amqp://192.168.99.100');
    }
}

let app = new MyApplication("samples");
app.start(8080);
