import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("arrayOf")
export class ArrayOf implements ISchemaTypeDefinition {
    description= "Must be an array of ${items}";
    $items= null;
    messages= [
        "Invalid value '{$value}' for '{$propertyName}', all values must be of type {$items}.",
        "Invalid value '{$value}' for '{$propertyName}', value must be an array.",
    ];
    validate(val) {
        if (!this.$items) return "You must define array item type with the 'items' property.";
        if (!Array.isArray(val)) return this.messages[1];
        let error = false;
        if (this.$items !== "any") {
            val.forEach(e => {
                if (e && typeof e !== this.$items) error = true;
            });
        }
        if (error) return this.messages[0];
    }
}