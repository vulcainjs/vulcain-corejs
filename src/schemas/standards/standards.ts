const uuid = require('uuid');
const validator = require('validator');

export class TYPES {
    static "String" = "string";
    static "Any" = "any";
    static "Boolean" = "boolean";
    static "Number" = "number";
    static "Integer" = "integer";
    static "Enum" = "enum";
    static "Uid" = "uid";
    static "ArrayOf" = "arrayOf";
    static "Email" = "email";
    static "Url" = "url";
    static "Alphanumeric" = "alphanumeric";
    static "Date-iso8601" = "date-iso8601";
}

export class VALIDATORS {
    static "Range" = "range";
    static "Pattern" = "pattern";
    static "Length" = "length";
}
