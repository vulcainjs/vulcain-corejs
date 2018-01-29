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

export let standards = {
    "$ref": {
        $cardinality: "one",
        $item: null,
        messages: [
            "Collection is not allowed for the reference '{$propertyName}' with cardinality = one.",
            "Reference '{$propertyName}' with cardinality = many must contains an array.",
            "Reference element for property '{$propertyName}' must be of type {$item}."
        ],
        validate: function (val) {
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
    },
    "any": {},
    "pattern": {
        description: "Must respect the regex expression {$pattern}",
        $pattern: null,
        message: "Property '{$propertyName}' must match the following pattern : {$pattern}",
        validate: function (val) {
            if (this.$pattern && new RegExp(this.$pattern).test(val) === false) return this.message;
        }
    },
    uid: {
        description: "Must be an UID (will be generated if null)",
        type: "string",
        bind: (v) => v || uuid.v1()
    },
    // Value must be a number between min and max
    range: {
        description: "Must be a number between {$min} and ${$max}",
        type: "number",
        $min: 0,
        $max: 1,
        message: "Invalid value '{$value}' for '{$propertyName}', value must be between {$min} and {$max}",
        validate: function (val) {
            if (val < this.$min || val > this.$max) return this.message;
        }
    },
    url: {
        description: "Must be an url",
        type: "string",
        message: "Property '{$propertyName}' must be an url.",
        validate: function (val) {
            if (!validator.isURL(val))
                return this.message;

        }
    },
    alphanumeric: {
        description: "Must be an alphanumeric string",
        type: "string",
        message: "Property '{$propertyName}' must be an alphanumeric.",
        validate: function (val, ctx = { locale: 'en-US' }) {

            if (!validator.isAlphanumeric(val, ctx.locale))
                return this.message;

        }
    },
    'date-iso8601': {
        description: "Must be an ISO8061 date",
        type: "string",
        message: "Property '{$propertyName}' must be an date on ISO8601 format.",
        validate: function (val, ctx = { locale: 'en-US' }) {

            if (!validator.isISO8601(val))
                return this.message;

        }
    }
};
