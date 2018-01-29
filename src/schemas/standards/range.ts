import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("range")
export class Range implements ISchemaTypeDefinition {
    description = "Must be a number between {$min} and ${$max}";
    type = "number";
    $min = 0;
    $max = 1;
    message = "Invalid value '{$value}' for '{$propertyName}', value must be between {$min} and {$max}";
    validate(val) {
        if (val < this.$min || val > this.$max) return this.message;
    }
}