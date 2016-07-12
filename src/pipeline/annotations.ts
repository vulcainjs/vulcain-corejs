import 'reflect-metadata';
import {CommandManager, CommandMetadata, ActionMetadata, EventMetadata, ConsumeEventMetadata} from './commands';
import {QueryManager, QueryMetadata} from './query';
import {Application} from '../application';
import {Domain} from '../schemas/schema';

const symActions = Symbol.for("handler:actions");

export function CommandHandler(metadata: CommandMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";
        let actions = Reflect.getOwnMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            CommandManager.commandHandlersFactory.register(app, target, actions, metadata);
        });
    }
}

export function Action(actionMetadata?: ActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target) || {};
        actions[key] = actionMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}

export function QueryHandler(metadata: QueryMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";

        let actions = Reflect.getOwnMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            QueryManager.handlerFactory.register(app, target, actions, metadata);
        });
    }
}

export function Query(actionMetadata?: ActionMetadata) {
	return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target) || {};
        actions[key] = actionMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}

export function EventHandler(metadata: EventMetadata) {
    return function (target: Function) {

        let actions = Reflect.getOwnMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            CommandManager.eventHandlersFactory.register(app, target, actions, metadata);
        });
    }
}

export function Consume(consumeMetadata?: ConsumeEventMetadata) {
	return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target) || {};
        actions[key] = consumeMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}
