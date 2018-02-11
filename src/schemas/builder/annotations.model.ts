import 'reflect-metadata';
import { Domain } from '../domain';
import { IRequestContext } from "../../pipeline/common";
import { SchemaBuilder } from './schemaBuilder';
import { Preloader } from '../../preloader';
import { IContainer } from '../../di/resolvers';

/**
 * Model metadata definition
 */
export interface ModelDefinition {
    /**
     * Model name (default class name)
     */
    name?: string;
    /**
     * Inherited type
     */
    extends?: string;
    /**
     * Model description
     */
    description?: string;
    /**
     * Coerce input data
     */
    coerce?: ((data) => any) | boolean;
    /**
     * Validatation function
     */
    validate?: (entity, ctx?: IRequestContext) => string;
    /**
     * Storage name (table or collection) - default = model name
     */
    storageName?: string;
    /**
     * This model (or its children) has sensible data - Required if you want obfuscate sensible type data
     */
    hasSensibleData?: boolean;
    inputModel?: boolean;
}

/**
 * Declare a data model
 */
export function Model(def?: ModelDefinition) {
    return function (target: Function) {
        def = def || {};
        def.name = def.name || target.name;
        def.storageName = def.storageName || def.name;

        // Try to infer inherit type
        if (!def.extends) {
            let ext = Object.getPrototypeOf(target).name;
            if (ext) def.extends = ext;
        }
        const sym = Symbol.for("design:model");
        Reflect.defineMetadata(sym, def, target);
        Preloader.instance.registerModel(target, (container: IContainer, domain) => {
            SchemaBuilder.buildSchema(domain, def, target);
        });
    };
}

export function InputModel(def?: ModelDefinition) {
    def = def || {};
    def.inputModel = true;
    return Model(def);
}