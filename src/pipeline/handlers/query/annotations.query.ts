import 'reflect-metadata';
import { ServiceDescriptors } from '../descriptions/serviceDescriptions';
import { QueryOperationDefinition, QueryDefinition } from './definitions';
import { Preloader } from '../../../preloader';
import { Service } from '../../../globals/system';
import { IContainer } from '../../../di/resolvers';
import { DefaultServiceNames } from '../../../di/annotations';
import { Utils } from '../utils';

//const symMetadata = Symbol.for("handler:metadata");
const symActions = Symbol.for("handler:actions");
const symMetadata = Symbol.for("handler:metadata");

/**
 * Define a query handler
 *
 * @export
 * @param {QueryActionMetadata} [def]
 * @returns
 */
export function Query(def: QueryOperationDefinition, metadata?:any) {
    return (target, key) => {
        let actions: { [name: string]: QueryOperationDefinition } = Reflect.getOwnMetadata(symActions, target.constructor) || {};
        actions[key] = def || <any>{};
        actions[key].metadata = metadata;

        if (!actions[key].inputSchema) {
            let params = Reflect.getMetadata("design:paramtypes", target, key);
            if (params && params.length > 0 && params[0].name !== "Object") {
                actions[key].inputSchema = Utils.resolveType(params[0]);
            }
        }
        let output = Reflect.getMetadata("design:returntype", target, key);
        if (output && ["Promise", "Object", "void 0", "null"].indexOf(output.name) < 0) {
            actions[key].outputSchema = Utils.resolveType(output.name);
        }
        if (!actions[key].action) {
            let tmp = key.toLowerCase();
            if (tmp.endsWith("async")) tmp = tmp.substr(0, tmp.length - 5);
            actions[key].action = tmp;
        }
        Reflect.defineMetadata(symActions, actions, target.constructor);
    };
}
