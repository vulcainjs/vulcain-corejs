import 'reflect-metadata';
import {CommandManager, ActionMetadata, ActionHandlerMetadata, EventMetadata, ConsumeEventMetadata} from './actions';
import {QueryManager, QueryMetadata, QueryActionMetadata} from './query';
import {Application} from '../application';
import {Domain} from '../schemas/schema';

const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

export function ActionHandler(metadata: ActionHandlerMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";
        let actions = Reflect.getMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            CommandManager.commandHandlersFactory.register(app, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

export function Action(actionMetadata?: ActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getMetadata(symActions, target) || {};
        actions[key] = actionMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}

export function QueryHandler(metadata: QueryMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";

        let actions = Reflect.getMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            QueryManager.handlerFactory.register(app, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

export function Query(actionMetadata?: QueryActionMetadata) {
	return (target, key) => {
        let actions = Reflect.getMetadata(symActions, target) || {};
        actions[key] = actionMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}

export function EventHandler(metadata: EventMetadata) {
    return function (target: Function) {

        let actions = Reflect.getMetadata(symActions, target.prototype) || {};

        Application.Preloads.push((app) => {
            CommandManager.eventHandlersFactory.register(app, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

export function Consume(consumeMetadata?: ConsumeEventMetadata) {
	return (target, key) => {
        let actions = Reflect.getMetadata(symActions, target) || {};
        actions[key] = consumeMetadata;
        Reflect.defineMetadata(symActions, actions, target);
	}
}
