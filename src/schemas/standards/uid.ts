import { ISchemaTypeDefinition } from "../schemaType";
import { SchemaTypeDefinition } from "../builder/annotations";
const uuid = require('uuid');

@SchemaTypeDefinition("uid")
export class UID implements ISchemaTypeDefinition {
    description= "Must be an UID (will be generated if null)";
    type= "string";
    bind(v) {
        return v || uuid.v1();
    }
}