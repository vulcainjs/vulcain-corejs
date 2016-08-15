const uuid = require('node-uuid')
import {DynamicConfiguration} from 'vulcain-configurationsjs';

export let standards = {
    "$ref": {
        $cardinality: "one",
        $item: null,
        messages: [
            "Collection is not allowed for the reference '{$propertyName}' with cardinality = one.",
            "Reference '{$propertyName}' with cardinality = many must contains an array.",
            "Reference element for property '{$propertyName}' must be of type {$item}."
        ],
        check: function(val) {
            if (this.$cardinality !== "one" && this.$cardinality !== "many")
                throw new Error("Incorrect cardinality. Allowed values are 'one' or 'many'");
            if(this.$cardinality == "one") {
                if(val && Array.isArray(val)) return this.messages[0];
                if(val && this.$item && val.__schema && val.__schema !== this.$item) return this.messages[2];
                return;
            }
            if(this.$cardinality == "many") {
                if(val && !Array.isArray(val)) return this.messages[1];
                if(this.$item && val) {
                    let ok = true;
                    val.forEach(v => {if(v.__schema) ok = ok || v.__schema === this.$item;});
                    if(!ok) return this.messages[2];
                }
                return;
            }
        }
    },
    "string": {
        $required:false,
        $pattern: null,
        messages: [
            "Property '{$propertyName}' is required.",
            "Property '{$propertyName}' must be a string.",
            "Property '{$propertyName}' must match the following pattern : {$pattern}"
        ],
        check: function(val) {
            if(this.$required && !val) return this.messages[0];
            if(val && typeof val !== "string") return this.messages[1];
            if(val && this.$pattern && new RegExp(this.$pattern).test(val) === false) return this.messages[2];
        }
    },
    "number": {
        $required:false,
        messages: [
            "Property '{$propertyName}' is required.",
            "Property '{$propertyName}' must be a number."
        ],
        check: function(val) {
            if(this.$required && !val) return this.messages[0];
            if(val && typeof val !== "number") return this.messages[1];
        }
    },
    "boolean": {
        $required:false,
        messages: [
            "Property '{$propertyName}' is required.",
            "Property '{$propertyName}' must be a boolean."
        ],
        check: function(val) {
            if(this.$required && !val) return this.messages[0];
            if(val && typeof val !== "boolean") return this.messages[1];
        }
    },
    "enum" : {
        type:"string",
        $values: [],
        $required:false,
        message: "Invalid property '{$propertyName}'. Must be one of [{$values}].",
        check: function(val) {
            if(!this.$required && !val) return;
            if(this.$values.indexOf(val) === - 1) return this.message;
        }
    },
    sensible : {
        type:"string",
        encrypt: (pwd: string) => pwd && DynamicConfiguration.encrypt(pwd),
        decrypt: (v) => v && DynamicConfiguration.decrypt(v)
    },
    uid: {
        type: "string",
        bind: (v) => v || uuid.v1()
    },
    "arrayOf": {
        $item    : "string",
        $required: false,
        messages : [
            "Invalid value '{$value}' for '{$propertyName}', all values must be of type {$item}.",
            "Invalid value '{$value}' for '{$propertyName}', value must be an array.",
        ],
        check    : function (val) {
            if(!this.$required && !val) return;
            if(!Array.isArray(val)) return this.messages[1];
            let error = false;
            val.forEach( e => {
               if( e && typeof e !== this.$item) error = true;
            });
            if(error) return this.messages[0];
        }
    },
    // Value must be a number between min and max
    range: {
        type: "number",
        $min: 0,
        $max: 1,
        $required: false,
        message: "Invalid value '{$value}' for '{$propertyName}', value must be between {$min} and {$max}",
        check: function (val) {
            return (!val && this.$required) || val >= this.min && val <= this.max;
        }
    }
};
