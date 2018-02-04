import { IRequestContext } from "../pipeline/common";
import { PropertyDefinition } from "./builder/annotations.property";

/**
 * Internal Property definition
 *
 */
export interface ModelPropertyDefinition extends PropertyDefinition {
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
    metadata?: any;
}

export interface SchemaInfo {
    name: string;
    description?: string;
    properties: { [index: string]: ModelPropertyDefinition };
    extends?: string;
    hasSensibleData?: boolean;
    coerce?: ((data) => any) | boolean;
    validate?: (val, ctx: IRequestContext) => string;
    storageName?: string;
    idProperty?: string;
    metadata?: any;
    isInputModel: boolean;
}