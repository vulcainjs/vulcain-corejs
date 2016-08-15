import 'reflect-metadata';
import {Preloader} from '../preloader';
import {CommandManager, ActionMetadata, ActionHandlerMetadata, EventMetadata, ConsumeEventMetadata} from './actions';
import {QueryManager, QueryMetadata, QueryActionMetadata} from './query';
import {Application} from '../application';
import {Domain} from '../schemas/schema';

const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");

function getMetadata(key, target) {
    let metadata = {};
    while (target) {
        let tmp = Reflect.getOwnMetadata(key, target);
        if (tmp) {
            // merge by action
            Object.keys(tmp).forEach(p => {
                let pv = tmp[p];
                // Do not override action
                if (Object.keys(metadata).findIndex(pm => metadata[pm].action === pv.action) < 0) {
                    metadata[p] = Object.assign({},pv); // clone
                }
            });
        }
        target = Object.getPrototypeOf(target);
    }
    return metadata;
}

export function ActionHandler(metadata: ActionHandlerMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";
        let actions = getMetadata(symActions, target);

        Preloader.registerPreload( target, (container, domain) => {
            CommandManager.commandHandlersFactory.register(container, domain, target, actions, metadata, true);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

export function Action(actionMetadata?: ActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = actionMetadata || {};
        if (!actions[key].inputSchema) {
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0 && params[0].name !== "Object") {
                actions[key].inputSchema = params[0];
            }
        }
        let output = Reflect.getMetadata("design:returntype", target, key);
        if (output && output.name !== "Object") {
            actions[key].outputSchema = output.name;
        }
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    }
}

export function QueryHandler(metadata: QueryMetadata) {
    return function (target: Function) {
        metadata.scope = metadata.scope || "?";
        let actions = getMetadata(symActions, target);

        Preloader.registerPreload( target, (container, domain) => {
            QueryManager.handlerFactory.register(container, domain, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

export function Query(actionMetadata?: QueryActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = actionMetadata || {};
        if (!actions[key].inputSchema) {
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0 && params[0].name !== "Object") {
                actions[key].inputSchema = params[0];
            }
        }
        let output = Reflect.getMetadata("design:returntype", target, key);
        if (output && output.name !== "Object") {
            actions[key].outputSchema = output.name;
        }
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    }
}

export function EventHandler(metadata: EventMetadata) {
    return function (target: Function) {

        let actions = getMetadata(symActions, target);

        Preloader.registerPreload( target, (container, domain) => {
            CommandManager.eventHandlersFactory.register(container, domain, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    }
}

/**
 *
 */
export function Consume(consumeMetadata?: ConsumeEventMetadata) {
	return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = consumeMetadata || {};
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
	}
}
