import 'reflect-metadata';
import { Domain } from '../domain';
import { IRequestContext } from "../../pipeline/common";
import { SchemaBuilder } from './schemaBuilder';
import { Preloader } from '../../preloader';
import { IContainer } from '../../di/resolvers';

/**
 * Model metadata definition
 */
export interface ModelOptions {
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
     * Transform input data
     */
    bind?: ((data) => any) | boolean;
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
    /**
     * Custom metadata
     */
    custom?: any;
}

/**
 * Declare a data model
 */
export function Model(options?: ModelOptions) {
    return function (target: Function) {
        options = options || {};
        options.name = options.name || target.name;
        options.storageName = options.storageName || options.name;

        // Try to infere inherit type
        if (!options.extends) {
            let ext = Object.getPrototypeOf(target).name;
            if (ext) options.extends = ext;
        }
        const sym = Symbol.for("design:model");
        Reflect.defineMetadata(sym, options, target);
        Preloader.instance.registerModel(target, (container: IContainer, domain) => {
            SchemaBuilder.buildSchema(domain, options, target);
        });
    };
}
