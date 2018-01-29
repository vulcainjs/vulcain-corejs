import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("integer")
export class Integer implements ISchemaTypeDefinition {
    description= "Must be an integer";
    message= "Property '{$propertyName}' must be an integer.";
    bind(val) {
        if (val === undefined) return val;
        if (/^(\-|\+)?([0-9]+([0-9]+)?)$/.test(val))
            return Number(val);
        return NaN;
    }
    validate(val) {
        if ((typeof val !== "number") || isNaN(val)) return this.message;
    }
}