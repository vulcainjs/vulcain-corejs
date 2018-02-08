import { Preloader } from '../../preloader';
import { IContainer } from '../../di/resolvers';
import 'reflect-metadata';
import { Domain } from '../domain';
import { IRequestContext } from "../../pipeline/common";
import { ModelPropertyDefinition } from '../schemaInfo';
import { SchemaBuilder } from './schemaBuilder';

/**
 * Property definition
 *
 * @export
 * @interface PropertyDefinition
 */
export interface PropertyDefinition {
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
    itemsType?: string;
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
     * Function to transform an input value. If null or false, the value is ignored.
     *
     *
     * @memberOf PropertyOptions
     */
    coerce?: ((val, entity) => any) | boolean;
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
    validate?: (val, ctx?: IRequestContext) => string;
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
    private?: boolean;
    /** 
     * Foreign key in case of reference
    */
    refProperty?: string;
}

export function Property(def?: PropertyDefinition, metadata?:any) {
    return (target, key) => {
        let info: ModelPropertyDefinition = def || <any>{};
        info.metadata = metadata || {};
        info.name = key;

        if (!info.type) {
            // Try to infer type
            let t = Reflect.getOwnMetadata('design:type', target, key);
            info.type = t && t.name && t.name.toLowerCase();
            if (!info.type) {
                throw new Error(`You must define a type for property ${key} in model ${target.constructor.name}`);
            }
        }
        if (!info.cardinality) {
            let t = Reflect.getOwnMetadata('design:type', target, key);
            if (t && t.name === "Array")
                (<any>info).$cardinality = "many"; // suspicion
        }

        const sym = Symbol.for("design:properties");
        const properties = Reflect.getOwnMetadata(sym, target) || [];
        properties.push(info);
        Reflect.defineMetadata(sym, properties, target);
    };
}

