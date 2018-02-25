import { Handler } from '../descriptions/serviceDescriptions';
import { IContainer } from '../../../di/resolvers';
import {Domain} from '../../../schemas/domain';
import { Service } from '../../../globals/system';
import * as util from 'util';
import { EventDefinition, ConsumeEventDefinition } from "../../../bus/messageBus";

export class EventHandlerFactory {
    private handlers = new Map<string, Map<string, Array<Handler>>>();

    *allHandlers(): Iterable<Handler> {
        for (let [vk, v] of this.handlers) {
            for (let [sk, s] of v)
            {
                for (let i of s)
                    yield i;
            }
        }
    }

    private checkIsUnique(name: string) {
        for (let [action, byActions] of this.handlers) {
            for (let [schema, bySchemas] of byActions) {
                for (let handler of bySchemas) {
                    if (handler.name === name)
                        return false;    
                }                
            }
        }
        return true;
    }

    /**
     * Register event handler methods
     */
    register(container: IContainer, domain: Domain, target: Function, actions: any, handlerMetadata: EventDefinition) {
        let domainName = handlerMetadata.subscribeToDomain || domain.name;
        handlerMetadata = handlerMetadata || {};

        if (handlerMetadata.schema) {
            // test if exists
            let tmp = domain.getSchema(handlerMetadata.schema);
            handlerMetadata.schema = tmp.name;
        }

        for (const action in actions) {
            if (!this.checkIsUnique(handlerMetadata.name || action)) {
                throw new Error(`Event handler named ${handlerMetadata.name || action} must be unique`);
            }
            let actionMetadata: ConsumeEventDefinition = actions[action];
            actionMetadata = actionMetadata || <ConsumeEventDefinition>{};

            if (actionMetadata.subscribeToSchema) {
                // test if exists
                let tmp                          = domain.getSchema(actionMetadata.subscribeToSchema);
                actionMetadata.subscribeToSchema = tmp.name;
            }

            let keys                         = [domainName];
            let schema                       = <string>actionMetadata.subscribeToSchema || <string>handlerMetadata.schema || "*";
            actionMetadata.subscribeToSchema = schema;
            actionMetadata.subscribeToAction = (actionMetadata.subscribeToAction || "*").toLowerCase();

            keys.push(actionMetadata.subscribeToAction);
            let handlerKey = keys.join('.').toLowerCase();

            let byActions = this.handlers.get(handlerKey);
            if (!byActions) {
                byActions = new Map<string, Array<Handler>>();
                this.handlers.set(handlerKey, byActions);
            }

            let bySchemas = byActions.get(schema);
            if (!bySchemas) {
                bySchemas = [];
                byActions.set(schema, bySchemas);
            }

            // Merge metadata
            let item: Handler = {
                kind: "event",
                name: handlerMetadata.name || action,
                methodName: action,
                definition: Object.assign({}, handlerMetadata, actionMetadata),
                handler: target
            };

            bySchemas.push(item);
            Service.log.info(null, ()=> util.format("Event handler registered for domain %s action %s schema %s", domainName, actionMetadata.subscribeToAction, schema));
        }
    }

    getFilteredHandlers(domain: string, schema: string, action: string)
    {
        let d = domain && domain.toLowerCase() + ".";
        let a = (action && action.toLowerCase()) || "*";
        let s = schema || "*";

        let items = [];

        let key = d + a;
        let infos = this.handlers.get(key);
        if (infos) {
            let tmp = infos.get(s);
            if (tmp)
                items = items.concat(tmp);
            if (s !== "*") {
                tmp = infos.get("*");
                if (tmp)
                    items = items.concat(tmp);
            }
        }

        if (a !== "*") {
            key = d + "*";
            infos = this.handlers.get(key);
            if (infos) {
                let tmp = infos.get(s);
                if (tmp)
                    items = items.concat(tmp);
                if (s !== "*") {
                    tmp = infos.get("*");
                    if (tmp)
                        items = items.concat(tmp);
                }
            }
        }
        return items;
    }
}
