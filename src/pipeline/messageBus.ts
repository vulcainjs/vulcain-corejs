import {CommandData, CommandResponse, CommandManager} from './commands';
import {ErrorResponse} from './common';
const guid = require('node-uuid');
import {ICommandBusAdapter, IEventBusAdapter} from '../bus/busAdapter';
import {DefaultServiceNames} from '../application';

export class MessageBus {
    public listeners: Array<(response:CommandResponse) => void> = [];
    private commandBus: ICommandBusAdapter;
    private eventBus: IEventBusAdapter;

    constructor(private manager: CommandManager) {
        this.commandBus = manager.container.get<ICommandBusAdapter>(DefaultServiceNames.CommandBusAdapter);
        this.commandBus.listenForTask(manager.domain.name, manager.serviceName, manager.consumeTaskAsync.bind(manager));

        this.eventBus = manager.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter);
        this.eventBus.listenForEvent(manager.domain.name, manager.consumeEventAsync.bind(manager));
    }

    pushTask(command: CommandData) {
        command.status = "Pending";
        command.taskId = guid.v4();
        this.commandBus.publishTask(command.domain, this.manager.serviceName, command);
    }

    sendEvent(response: CommandResponse) {
        this.eventBus.sendEvent(response.domain, response);
    }
}