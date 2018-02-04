import { PropertyDescription } from "./propertyDescription";

export class SchemaDescription {
    name: string;
    idProperty: string;
    properties: Array<PropertyDescription>;
    dependencies: Set<string>;
    metadata?: any;
}