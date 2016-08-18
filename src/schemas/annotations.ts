import {Preloader} from '../preloader';
import {IContainer} from '../di/resolvers';

export interface ModelOptions {
    name?: string;
    extends?: string;
    description?: string;
    bind?: ((data) => any)|boolean;
    onHttpResponse?: ((entity, container?:IContainer) => void) | boolean;
    validate?: (entity, container?:IContainer) => string;
    storageName?: string;
    encryptData?: boolean;
}

export function Model(options?: ModelOptions) {
    return function (target: Function) {
        options = options || {};
        options.name = options.name || target.name;
        const sym = Symbol.for("design:model");
        Reflect.defineMetadata(sym, options, target);
        Preloader.registerPreload(target, (container, domain) => domain.addSchemaDescription(target, options.name));
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
    elem?: string;
    bind?: ((val, entity) => any)|boolean;
    dependsOn?: (entity) => boolean;
    validate?: (val) => string;
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
    dependsOn?: (entity) => boolean;
    validate?: (val) => string;
}

export function Reference(info: ReferenceOptions) {
	return (target, key) => {
        const symReferences = Symbol.for("design:references");
        var properties = Reflect.getOwnMetadata(symReferences, target) || {};
        properties[key] = info;
        Reflect.defineMetadata(symReferences, properties, target)
	}
}
