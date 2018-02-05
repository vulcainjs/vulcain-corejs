import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("id")
export class ID implements ISchemaTypeDefinition {
    description= "Must be a string or a number";
    message= "Property '{$propertyName}' must be a string or a number.";
    validate(val) {
        if (typeof val !== "string" && typeof val !== "number") return this.message;
    }
}