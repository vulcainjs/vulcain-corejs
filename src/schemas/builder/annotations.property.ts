import { Preloader } from '../../preloader';
import { IContainer } from '../../di/resolvers';
import 'reflect-metadata';
import { Domain } from '../domain';
import { RequestContext } from "../../pipeline/requestContext";
import { ModelPropertyInfo } from '../schemaInfo';
import { SchemaBuilder } from './schemaBuilder';

/**
 * Property definition
 *
 * @export
 * @interface PropertyOptions
 */
export interface PropertyOptions {
    /**
     * Base type
     *
     * @type {string} - a valid base type
     * @memberOf PropertyOptions
     */
    type?: string;
    /**
     * List of values for 'enum' type
     *
     * @type {string[]} - An array of values
     * @memberOf PropertyOptions
     */
    values?: string[];
    /**
     * True is this property is required
     *
     * @type {boolean}
     * @memberOf PropertyOptions
     */
    required?: boolean;
    /**
     * Property description
     *
     * @type {string}
     * @memberOf PropertyOptions
     */
    description?: string;
    /**
     * Item type property of type 'ArrayOf'
     *
     * @type {string} - A valid type for all elements of the array
     * @memberOf PropertyOptions
     */
    items?: string;
    /**
     * Entity key - Only one property by entity can be define.
     *
     * @type {boolean}
     * @memberOf PropertyOptions
     */
    isKey?: boolean;
    /**
     * Used to create an unique index key - Supports multiple property keys
     *
     * @type {boolean}
     * @memberOf PropertyOptions
     */
    unique?: boolean;
    /**
     * Cardinality in case of reference
     */
    cardinality?: 'one' | 'many' | undefined;
    /**
     * Function to transform an input value. If null or false, the value are ignored.
     *
     *
     * @memberOf PropertyOptions
     */
    bind?: ((val, entity) => any) | boolean;
    /**
     * Provide a way to check if a validation should be done.
     * validation are skipped, if the function returns false.
     *
     * @memberOf PropertyOptions
     */
    dependsOn?: (entity) => boolean;
    /**
     * Custom validation. This validation runs after all others validators
     *
     *
     * @memberOf PropertyOptions
     */
    validate?: (val, ctx?: RequestContext) => string;
    /**
     * Define if the property contains sensible data.
     * Sensible datas are obfuscated and are removed from get request.
     * This behavior only works with built-in provider and command.
     *
     * @type {boolean}
     * @memberOf PropertyOptions
     */
    sensible?: boolean;
    /**
     * Property sequence order
     */
    order?: number;
    /**
     * This property is not exposed by service description
     */
    private?:boolean
}

export function Property(options?: PropertyOptions, customOptions?:any) {
    return (target, key) => {
        let info: ModelPropertyInfo = options || <any>{};
        info.custom = customOptions;
        info.name = key;
        
        if (!info.type) {
            // Try to infer type
            let t = Reflect.getOwnMetadata('design:type', target, key);
            info.type = t && t.name;
            if (!info.type || ['string','number','boolean'].indexOf(info.type) < 0) {
                throw new Error(`You must define a type for property ${key} in model ${target.constructor.name}`);
            }
        }

        const sym = Symbol.for("design:model");
        const schema = Reflect.getOwnMetadata(sym, target);
        SchemaBuilder.addProperty(schema.name, info);
    };
}

