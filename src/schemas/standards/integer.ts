import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("integer")
export class Integer implements ISchemaTypeDefinition {
    description= "Must be an integer";
    message= "Property '{$propertyName}' must be an integer.";
    coerce(val) {
        if (val === undefined || typeof val === "number") return val;
        if (/^(\-|\+)?([0-9]+([0-9]+)?)$/.test(val))
            return Number(val);
        return NaN;
    }
    validate(val) {
        if ((typeof val !== "number") || isNaN(val)) return this.message;
    }
}