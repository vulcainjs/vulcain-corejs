import 'reflect-metadata';
import { ActionDefinition, ActionHandlerDefinition } from './definitions';
import { ServiceDescriptors } from '../descriptions/serviceDescriptions';
import { Service } from '../../../globals/system';
import { ConsumeEventDefinition } from "../messageBus";
import { Preloader } from '../../../preloader';
import { DefaultServiceNames } from '../../../di/annotations';
import { IContainer } from '../../../di/resolvers';
import { DefaultActionHandler } from "../../../defaults/crudHandlers";
import { EventDefinition } from "../messageBus";
import { CommandManager } from './actionManager';
import { Utils } from '../utils';
import { ApplicationError } from '../../../pipeline/errors/applicationRequestError';

//const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");
const symMetadata = Symbol.for("handler:metadata");

/**
 * Define an action handler
 *
 * @export
 * @param {ActionDefinition} [def]
 * @returns
 */
export function Action(def: ActionDefinition, metadata?: any) {
    return (target, key) => {
        let actions: {[name:string]: ActionDefinition} = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = def || <any>{};
        actions[key].metadata = metadata;

        if (actions[key].inputSchema === undefined) { // null means take schema name
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0) {
                actions[key].inputSchema = params[0].name !== "Object" ? Utils.resolveType(params[0]) : null; // Force null to take the schema as default value
            }
            else {
                actions[key].inputSchema = "none"; // set to none to ignore this schema
            }
        }

        let output = Reflect.getMetadata("design:returntype", target, key);
        if (actions[key].outputSchema === undefined) {
            actions[key].outputSchema = "none";
            if (output && ["Promise", "Object"].indexOf(output.name) < 0) {
                actions[key].outputSchema = Utils.resolveType(output.name);
            }
        }
        if (!actions[key].name) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].name = tmp;
        }
        if (!/^[_a-zA-Z][a-zA-Z0-9]*$/.test(actions[key].name)) {
            if (actions[key].name[0] !== '_' || !actions[key].metadata.system)  // Only system handler can begin with _ (to be consistant withj graphql)              
                throw new ApplicationError(`Action name ${actions[key].name}has invalid caracter. Must be '[a-zA-Z][a-zA-Z0-9]*'`);
        }
        
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}

/**
 * Define an event handler
 *
 * @export
 * @param {ConsumeEventDefinition} [consumeMetadata]
 * @returns
 */
export function Consume(def?: ConsumeEventDefinition, metadata?:any) {
    return (target, key) => {
        let actions: { [name: string]: ConsumeEventDefinition } = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = def || <any>{};
        actions[key].metadata = metadata;

        if (!actions[key].distributionKey) {
            // Used if distributionMode==='once'
            actions[key].distributionKey = (target.name + ":" + key).toLowerCase();
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}

/**
 * Define an action handler class
 *
 * @export
 * @param {ActionHandlerDefinition} def
 * @returns
 */
export function ActionHandler(def: ActionHandlerDefinition, metadata?: any) {
    return function (target: Function) {
        if (def.enableOnTestOnly && !Service.isTestEnvironment)
            return;
        def.scope = def.scope || "?";
        def.metadata = metadata;

        Preloader.instance.registerHandler(target, (container: IContainer, domain) => {
            const symModel = Symbol.for("design:model");
            let modelMetadatas = Reflect.getOwnMetadata(symModel, target);

            // Special case : ActionHandler targets a model
            if (modelMetadatas) {
                def.schema = modelMetadatas.name || target.name;
                let newName = '$$' + target.name + 'ActionHandler';
                target = class extends DefaultActionHandler { };
                Object.defineProperty(target, 'name', { value: newName, configurable: true });
            }

            let descriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
            let actions = Utils.getMetadata(symActions, target);
            descriptors.register(container, domain, target, actions, def, "action");

            // For DefaultHandler, register the associated command
            target.prototype.defineCommand && target.prototype.defineCommand.call(null, def);

            Reflect.defineMetadata(symMetadata, def, target);
        });
    };
}

/**
 * Define an event handler class
 *
 * @export
 * @param {EventDefinition} [metadata]
 * @returns
 */
export function EventHandler(def?: EventDefinition, metadata?: any) {
    def = def || {};
    def.metadata = metadata;

    return function (target: Function) {
        Preloader.instance.registerHandler(target, (container, domain) => {
            let actions = Utils.getMetadata(symActions, target);
            CommandManager.eventHandlersFactory.register(container, domain, target, actions, def);
            Reflect.defineMetadata(symMetadata, def, target);
        });
    };
}

