import {MessageBus} from './messageBus';
import {RequestContext} from '../servers/requestContext';

export class TaskManager {
    constructor(private bus: MessageBus, private context: RequestContext) {
    }

    submit(action:string) {

    }
}