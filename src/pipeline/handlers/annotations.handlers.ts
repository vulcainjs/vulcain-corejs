import 'reflect-metadata';
import { Preloader } from '../../preloader';
import { CommandManager, ActionMetadata, ActionHandlerMetadata } from './actions';
import { QueryMetadata, QueryActionMetadata } from './query';
import { ServiceDescriptors } from './serviceDescriptions';
import { DefaultServiceNames } from '../../di/annotations';
import { IContainer } from '../../di/resolvers';
import { System } from '../../globals/system';
import { DefaultQueryHandler, DefaultActionHandler } from "../../defaults/crudHandlers";
import { EventMetadata } from "./messageBus";

const symActions = Symbol.for("handler:actions");
const symMetadata = Symbol.for("handler:metadata");

function getMetadata(key, target) {
    let metadata = {};
    while (target) {
        let tmp = Reflect.getOwnMetadata(key, target);
        if (tmp) {
            // merge by action
            Object.keys(tmp).forEach(p => {
                let pv = tmp[p];
                // Do not override action
                if (!pv.action || Object.keys(metadata).findIndex(pm => metadata[pm].action === pv.action) < 0) {
                    metadata[p] = Object.assign({}, pv); // clone
                }
            });
        }
        target = Object.getPrototypeOf(target);
    }
    return metadata;
}

/**
 * Define an action handler class
 *
 * @export
 * @param {ActionHandlerMetadata} metadata
 * @returns
 */
export function ActionHandler(metadata: ActionHandlerMetadata) {
    return function (target: Function) {
        if (metadata.enableOnTestOnly && !System.isTestEnvironnment)
            return;
        metadata.scope = metadata.scope || "?";

        Preloader.instance.registerHandler(target, (container: IContainer, domain) => {
            const symModel = Symbol.for("design:model");
            let modelMetadatas = Reflect.getOwnMetadata(symModel, target);
            if (modelMetadatas) {
                // ActionHandler targets a model
                metadata.schema = modelMetadatas.name || target.name;
                let newName = '$$' + target.name + 'ActionHandler';
                target = class extends DefaultActionHandler { };
                Object.defineProperty(target, 'name', {value: newName, configurable: true});
            }
            let descriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
            let actions = getMetadata(symActions, target);
            descriptors.register(container, domain, target, actions, metadata, "action");
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    };
}

/**
 * Define a query handler class
 *
 * @export
 * @param {QueryMetadata} metadata
 * @returns
 */
export function QueryHandler(metadata: QueryMetadata) {
    return function (target: Function) {
        if (metadata.enableOnTestOnly && !System.isTestEnvironnment)
            return;
        metadata.scope = metadata.scope || "?";

        Preloader.instance.registerHandler(target, (container: IContainer, domain) => {
            const symModel = Symbol.for("design:model");
            let modelMetadatas = Reflect.getOwnMetadata(symModel, target);
            if (modelMetadatas) {
                // QueryHandler targets a model
                metadata.schema = modelMetadatas.name || target.name;
                let newName = '$$' + target.name + 'QueryHandler';
                target = class extends DefaultQueryHandler<any> { };
                Object.defineProperty(target, 'name', {value: newName, configurable: true});
            }
            let descriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
            let actions = getMetadata(symActions, target);
            descriptors.register(container, domain, target, actions, metadata, "query");
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
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
        Preloader.instance.registerHandler(target, (container, domain) => {
            let actions = getMetadata(symActions, target);
            CommandManager.eventHandlersFactory.register(container, domain, target, actions, metadata);
            Reflect.defineMetadata(symMetadata, metadata, target);
        });
    };
}
