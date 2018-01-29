import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";
const validator = require('validator');

@SchemaTypeDefinition("alphanumeric")
export class Alphanumeric implements ISchemaTypeDefinition {
    description = "Must be an alphanumeric string";
    type = "string";
    message = "Property '{$propertyName}' must be an alphanumeric.";
    validate(val, ctx = { locale: 'en-US' }) {
        if (!validator.isAlphanumeric(val, ctx.locale))
            return this.message;
    }
}