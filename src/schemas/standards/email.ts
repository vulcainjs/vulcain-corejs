import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";
const validator = require('validator');

@SchemaTypeDefinition("email")
export class Email implements ISchemaTypeDefinition {
    description = "Must be an email";
    message = "Property '{$propertyName}' must be an email.";
    type = "string";
    validate(val) {
        if ((typeof val !== "string")) return this.message;

        if (!validator.isEmail(val))
            return this.message;
    }
}