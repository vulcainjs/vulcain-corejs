import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("string")
export class String implements ISchemaTypeDefinition {
    description= "Must be a string";
    message = "Property '{$propertyName}' must be a string.";
    scalarType = "string";
    validate(val) {
        if (typeof val !== "string") return this.message;
    }
}