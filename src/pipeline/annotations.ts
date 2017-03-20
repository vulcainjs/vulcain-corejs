import 'reflect-metadata';
import { Preloader } from '../preloader';
import { CommandManager, ActionMetadata, ActionHandlerMetadata, EventMetadata, ConsumeEventMetadata } from './actions';
import { QueryMetadata, QueryActionMetadata } from './query';
import { ServiceDescriptors } from './serviceDescriptions';
import { DefaultServiceNames } from './../di/annotations';
import { IContainer } from './../di/resolvers';
import { System } from '../configurations/globals/system';
import { DefaultActionHandler, DefaultQueryHandler } from "../defaults/crudHandlers";

//const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");
const symMetadata = Symbol.for("handler:metadata");

function resolveType(type): string {
    if (typeof type === "function" && ServiceDescriptors.nativeTypes.indexOf(type.name) >= 0)
        return type.name;
    return type;
}

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
                    metadata[p] = Object.assign({}, pv); // clone
                }
            });
        }
        target = Object.getPrototypeOf(target);
    }
    return metadata;
}

/**
 * Define an action handler
 *
 * @export
 * @param {ActionMetadata} [actionMetadata]
 * @returns
 */
export function Action(actionMetadata: ActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = actionMetadata || {};
        if (actions[key].inputSchema === undefined) { // null means take schema name
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0) {
                actions[key].inputSchema = params[0].name !== "Object" ? resolveType(params[0]) : null; // Force null to take the schema as default value
            }
            else {
                actions[key].inputSchema = "none"; // set to to none to ignore this schema
            }
        }

        let output = Reflect.getMetadata("design:returntype", target, key);
        if (actions[key].outputSchema === undefined) {
            actions[key].outputSchema = "none";
            if (output && ["Promise", "Object"].indexOf(output.name) < 0) {
                actions[key].outputSchema = resolveType(output.name);
            }
        }
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}

/**
 * Define a query handler
 *
 * @export
 * @param {QueryActionMetadata} [actionMetadata]
 * @returns
 */
export function Query(actionMetadata: QueryActionMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = actionMetadata || {};
        if (!actions[key].inputSchema) {
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0 && params[0].name !== "Object") {
                actions[key].inputSchema = resolveType(params[0]);
            }
        }
        let output = Reflect.getMetadata("design:returntype", target, key);
        if (output && ["Promise", "Object", "void 0", "null"].indexOf(output.name) < 0) {
            actions[key].outputSchema = resolveType(output.name);
        }
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}

/**
 * Define an event handler class
 *
 * @export
 * @param {EventMetadata} [metadata]
 * @returns
 */
export function EventHandler(metadata?: EventMetadata) {
    return function (target: Function) {
        let actions = getMetadata(symActions, target);

        Preloader.instance.registerHandler(target, (container, domain) => {
            CommandManager.eventHandlersFactory.register(container, domain, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    };
}

/**
 * Define an event handler
 *
 * @export
 * @param {ConsumeEventMetadata} [consumeMetadata]
 * @returns
 */
export function Consume(consumeMetadata?: ConsumeEventMetadata) {
    return (target, key) => {
        let actions = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = consumeMetadata || {};
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}
