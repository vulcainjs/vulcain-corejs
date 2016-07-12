// Entry point
import {DefaultServiceNames, RabbitAdapter, Application} from './core';
import {AccountManagement} from './accountManagement';

class MyApplication extends Application {
    initializeServices() {
        this.useRabbitAdapter('amqp://192.168.99.100');
        AccountManagement.init(this.container);
    }
}

let app = new MyApplication("samples");
app.start(8080);
