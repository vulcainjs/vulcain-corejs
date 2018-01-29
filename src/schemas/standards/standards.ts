const uuid = require('uuid');
const validator = require('validator');

export class SchemaStandardTypes {
    static "string" = "string";
    static "any" = "any";
    static "boolean" = "boolean";
    static "number" = "number";
    static "integer" = "integer";
    static "enum" = "enum";
    static "uid" = "uid";
    static "arrayOf" = "arrayOf";
    static "email" = "email";
    static "url" = "url";
    static "alphanumeric" = "alphanumeric";
    static "date-iso8601" = "date-iso8601";
}

export class SchemaStandardValidators {
    static "range" = "range";
    static "pattern" = "pattern";
    static "len" = "length";
}
