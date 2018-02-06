import { IRequestContext } from "../pipeline/common";

export interface ISchemaValidation {
    description?: string;
    type?: string;
    validate?: (val: any, ctx: IRequestContext) => string;
}

export interface ISchemaTypeDefinition extends ISchemaValidation {
    scalarType?: string;
    name?: string;
    coerce?: (val: any) => any;
}
