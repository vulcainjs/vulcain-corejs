import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("boolean")
export class Boolean implements ISchemaTypeDefinition {
    description = "Must be a boolean";
    message = "Property '{$propertyName}' must be a boolean.";
    scalarType = "boolean";
    coerce(val) {
        if (val === undefined || typeof val === "boolean") return val;
        return (typeof val === "string") ? val === "true" : !!val;
    }
    validate(val) {
        if (typeof val !== "boolean") return this.message;
    }
}