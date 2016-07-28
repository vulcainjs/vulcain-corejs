import {Application} from '../application';
import {IContainer} from '../di/resolvers';

export interface ModelOptions {
    name?: string;
    extends?: string;
    description?: string;
    bind?: ((data) => any)|boolean;
    preCreate?: (entity, container?:IContainer) => any;
    preUpdate?: (entity, container?:IContainer) => any;
    postGet?: (entity, container?:IContainer) => any;
    validate?: (entity, container?:IContainer) => string;
    storageName?: string;
}

export function Model(name:string, options?: ModelOptions) {
    return function (target: Function) {
        options = options || {name:name};
        options.name = name;
        const sym = Symbol.for("design:model");
        Reflect.defineMetadata(sym, options, target);
        Application.registerPreload(target, (container, domain) => domain.addSchemaDescription(target, name));
   }
}

export interface PropertyOptions {
    type: string;
    values?: string[];
    required?: boolean;
    pattern?: string;
    description?: string;
    isKey?: boolean;
    item?: string;
    unique?: boolean;
    meta?: any;
    bind?: ((val, entity) => any)|boolean;
    dependsOn?: (entity) => boolean;
    check?: (val) => string;
}

export function Property(info:PropertyOptions) {
	return (target, key) => {
        const symProperties = Symbol.for("design:properties");
        var properties = Reflect.getOwnMetadata(symProperties, target) || {};
        properties[key] = info;
        Reflect.defineMetadata(symProperties, properties, target)
	}
}

export interface ReferenceOptions {
    item: string;
    cardinality: 'one' | 'many';
    description?: string;
    meta?: any;
    bind?: ((val) => any)|boolean;
    serialize?: ((val) => any | boolean)|boolean;
    dependsOn?: (entity) => boolean;
    check?: (val) => string;
}

export function Reference(info: ReferenceOptions) {
	return (target, key) => {
        const symReferences = Symbol.for("design:references");
        var properties = Reflect.getOwnMetadata(symReferences, target) || {};
        properties[key] = info;
        Reflect.defineMetadata(symReferences, properties, target)
	}
}