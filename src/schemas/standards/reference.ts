import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("$ref")
export class Reference implements ISchemaTypeDefinition {
    $cardinality = "one";
    $item = null;
    messages = [
        "Collection is not allowed for the reference '{$propertyName}' with cardinality = one.",
        "Reference '{$propertyName}' with cardinality = many must contains an array.",
        "Reference element for property '{$propertyName}' must be of type {$item}."
    ];
    validate(val) {
        if (this.$cardinality !== "one" && this.$cardinality !== "many")
            throw new Error("Incorrect cardinality. Allowed values are 'one' or 'many'");
        if (this.$cardinality === "one") {
            if (Array.isArray(val)) return this.messages[0];
            if (this.$item && val.__schema && val.__schema !== this.$item) return this.messages[2];
            return;
        }
        if (this.$cardinality === "many") {
            if (!Array.isArray(val)) return this.messages[1];
            if (this.$item && val) {
                let ok = true;
                val.forEach(v => {
                    if (v.__schema) ok = ok || v.__schema === this.$item;
                });
                if (!ok) return this.messages[2];
            }
            return;
        }
    }
}