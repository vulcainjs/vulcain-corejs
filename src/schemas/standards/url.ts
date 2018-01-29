import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";
const validator = require('validator');

@SchemaTypeDefinition("url")
export class Url implements ISchemaTypeDefinition {
    description = "Must be an url";
    type = "string";
    message = "Property '{$propertyName}' must be an url.";
    validate(val) {
        if (!validator.isURL(val))
            return this.message;
    }
}