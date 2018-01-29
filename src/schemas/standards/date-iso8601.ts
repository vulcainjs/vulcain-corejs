import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";
const validator = require('validator');

@SchemaTypeDefinition("date-iso8601")
export class DateIso8601 implements ISchemaTypeDefinition {
    description = "Must be an ISO8061 date";
    type = "string";
    message = "Property '{$propertyName}' must be an date on ISO8601 format.";
    validate(val) {
        if (!validator.isISO8601(val))
            return this.message;
    }
}