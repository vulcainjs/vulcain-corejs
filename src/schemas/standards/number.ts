import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";

@SchemaTypeDefinition("number")
export class Number implements ISchemaTypeDefinition {
    description= "Must be a number.";
    message= "Property '{$propertyName}' must be a number.";
    coerce(val) {
        if (val === undefined || typeof val === "number") return val;
        if (/^ (\-|\+)?([0 - 9] + (\.[0 - 9] +)?) $ /.test(val))
            return parseFloat(val);
        return NaN;
    }
    validate(val) {
        if ((typeof val !== "number") || isNaN(val)) return this.message;
    }
}