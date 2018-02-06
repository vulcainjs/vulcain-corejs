import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("pattern")
export class Pattern implements ISchemaTypeDefinition {
    description = "Must respect the regex expression {$pattern}";
    $pattern = null;
    type = "string";
    message = "Property '{$propertyName}' must match the following pattern : {$pattern}";
    validate(val) {
        if (this.$pattern && new RegExp(this.$pattern).test(val) === false) return this.message;
    }
}