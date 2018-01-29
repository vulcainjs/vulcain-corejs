import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("length")
export class Length implements ISchemaTypeDefinition {
    description = "Must have a length between ${min} and ${max}";
    type = "string";
    $min: number;
    $max: number;
    messages = [
        "Property '{$propertyName}' must have at least {$min} characters.",
        "Property '{$propertyName}' must have no more than {$max} characters."
    ];
    validate(val) {
        let len = val.length;
        if (this.$min !== undefined) {
            if (len < this.$min) return this.messages[0];
        }
        if (this.$max !== undefined) {
            if (len > this.$max) return this.messages[1];
        }
    }
}