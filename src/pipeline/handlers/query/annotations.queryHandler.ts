import 'reflect-metadata';
import { ServiceDescriptors } from '../descriptions/serviceDescriptions';
import { QueryOperationDefinition, QueryDefinition } from './definitions';
import { Preloader } from '../../../preloader';
import { Service } from '../../../globals/system';
import { IContainer } from '../../../di/resolvers';
import { DefaultServiceNames } from '../../../di/annotations';
import { Utils } from '../utils';
import { DefaultQueryHandler } from '../../../defaults/crudHandlers';

const symActions = Symbol.for("handler:actions");
const symMetadata = Symbol.for("handler:metadata");

/**
 * Define a query handler class
 *
 * @export
 * @param {QueryMetadata} def
 * @returns
 */
export function QueryHandler(def: QueryDefinition, metadata?: any) {
    return function (target: Function) {
        if (def.enableOnTestOnly && !Service.isTestEnvironment)
            return;
        def.scope = def.scope || "?";
        def.metadata = metadata;

        Preloader.instance.registerHandler(target, (container: IContainer, domain) => {
            const symModel = Symbol.for("design:model");
            let modelMetadatas = Reflect.getOwnMetadata(symModel, target);
            if (modelMetadatas) {
                // QueryHandler targets a model
                def.schema = modelMetadatas.name || target.name;
                let newName = '$$' + target.name + 'QueryHandler';
                target = class extends DefaultQueryHandler<any> { };
                Object.defineProperty(target, 'name', { value: newName, configurable: true });
            }
            let descriptors = container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
            let actions = Utils.getMetadata(symActions, target);
            descriptors.register(container, domain, target, actions, def, "query");
            // DefaultHandler
            target.prototype.defineCommand && target.prototype.defineCommand.call(null, def);
            Reflect.defineMetadata(symMetadata, def, target);
        });
    };
}
