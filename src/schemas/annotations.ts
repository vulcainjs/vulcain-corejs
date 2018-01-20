import { Preloader } from '../preloader';
import { IContainer } from '../di/resolvers';
import 'reflect-metadata';
import { Domain } from './schema';
import { RequestContext } from "../pipeline/requestContext";

export interface SchemaTypeDefinitionOptions {
    name?: string;
    ns?: string;
}

export interface ISchemaTypeDefinition {
    validate: (val: any, ctx: RequestContext) => string;
    bind?: (val: any) => any;
}

/**
 * Define a new type to use with model property
 * @param name Type name (default to class name)
 * @param ns Namespace
 */
export function SchemaTypeDefinition(options?: SchemaTypeDefinitionOptions) {
    return function (target: any) {
        Preloader.instance.registerType(target, (container, domain: Domain) => {
            domain.addType((options && options.name) || target.name, new target.prototype.constructor(), (options && options.ns) || "");
        });
    };
}

export interface ModelOptions {
    name?: string;
    extends?: string;
    description?: string;
    bind?: ((data) => any) | boolean;
    validate?: (entity, ctx?: RequestContext) => string;
    storageName?: string;
    hasSensibleData?: boolean;
    custom?: any;
}

export function Model(options?: ModelOptions) {
    return function (target: Function) {
        options = options || {};
        options.name = options.name || target.name;
        if (!options.extends) {
            let ext = Object.getPrototypeOf(target).name;
            if (ext) options.extends = ext;
        }
        const sym = Symbol.for("design:model");
        Reflect.defineMetadata(sym, options, target);
        Preloader.instance.registerModel(target, (container, domain: Domain) => domain.addSchemaDescription(target, options.name));
    };
}

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

/**
 * Property definition
 *
 * @export
 * @interface PropertyOptions
 */
export interface ModelPropertyOptions extends PropertyOptions {
     /**
     * List of validators - Do not use directly, use @Validator instead
     *
     * @type {Array<any>}
     * @memberOf PropertyOptions
     */
    validators?: Array<any>;
    /**
     * Custom options for custom types
     *
     * @memberOf PropertyOptions
     */
    custom?: any;
}

export function Property(info?: PropertyOptions, customOptions?:any) {
    return (target, key) => {
        const symProperties = Symbol.for("design:properties");
        let properties = Reflect.getOwnMetadata(symProperties, target) || {};
        let data: ModelPropertyOptions = info || <any>{};
        data.custom = customOptions;
        if (!data.type) {
            let t = Reflect.getOwnMetadata('design:type', target, key);
            data.type = t && t.name;
            if (!data.type || ['string','number','boolean'].indexOf(data.type) < 0) {
                throw new Error(`You must define a type for property ${key} in model ${target.constructor.name}`);
            }
        }
        properties[key] = data;
        Reflect.defineMetadata(symProperties, properties, target);
    };
}

export function Validator(name: string, options?) {
    return (target, key) => {
        const symValidators = Symbol.for("design:validators");
        let validators = Reflect.getOwnMetadata(symValidators, target, key) || [];
        validators.push({ name, options });
        Reflect.defineMetadata(symValidators, validators, target, key);
    };
}

export interface ReferenceOptions {
    item: string;
    cardinality: 'one' | 'many';
    required?: boolean;
    description?: string;
    bind?: ((val) => any) | boolean;
    dependsOn?: (entity) => boolean;
    validate?: (val, ctx?: RequestContext) => string;
    validators?: Array<any>;
    type?: string;
    order?: number;
    private?: boolean;
}

export function Reference(info: ReferenceOptions) {
    return (target, key) => {
        const symReferences = Symbol.for("design:references");
        let properties = Reflect.getOwnMetadata(symReferences, target) || {};
        properties[key] = info;
        Reflect.defineMetadata(symReferences, properties, target);
    };
}
