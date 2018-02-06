import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("enum")
export class Enumeration implements ISchemaTypeDefinition {
    description = "Must be one of [{$values}]";
    type = "string";
    $values: string[];
    message = "Invalid property '{$propertyName}'. Must be one of [{$values}].";
    validate(val) {
        if (!this.$values) return "You must define a list of valid values with the 'values' property.";
        if (this.$values.indexOf(val) === -1) return this.message;
    }
}