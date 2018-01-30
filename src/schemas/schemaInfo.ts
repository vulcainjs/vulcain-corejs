import { IRequestContext } from "../pipeline/common";
import { PropertyOptions } from "./builder/annotations.property";

/**
 * Internal Property definition
 *
 */
export interface ModelPropertyInfo extends PropertyOptions {
    name: string;
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

export interface SchemaInfo {
    name: string;
    description?: string;
    properties: { [index: string]: ModelPropertyInfo };
    extends?: string;
    hasSensibleData?: boolean;
    coerce?: ((data) => any) | boolean;
    validate?: (val, ctx: IRequestContext) => string;
    storageName?: string;
    idProperty?: string;
    custom?: any;
}