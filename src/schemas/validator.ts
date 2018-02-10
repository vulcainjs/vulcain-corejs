import { IContainer } from '../di/resolvers';
import { IRequestContext } from "../pipeline/common";
import { Domain } from './domain';
import { Schema } from './schema';
import { ModelPropertyDefinition } from './schemaInfo';

export class Validator {

    constructor(private domain: Domain) {
    }

    async validate(ctx: IRequestContext, schema: Schema, val:any, parentName:string=""): Promise<{ [propertyName: string]: string }> {
        let errors: { [propertyName: string]: string } = {};
        if (!schema || !val) return errors;

        if (schema.extends) {
            if (schema.extends) {
                let errorList = (await this.validate(ctx, schema.extends, val));
                errors = Object.assign(errors, errorList);
            }
        }

        let id = val && val[schema.getIdProperty()];
        let formatContext: FormatContext = { element: val, schemaElement: schema, id: id };

        // Properties checks
        for (const propertyName in schema.info.properties) {
            if (!schema.info.properties.hasOwnProperty(propertyName)) continue;

            formatContext.propertyName = parentName + propertyName;
            formatContext.propertySchema = schema.info.properties[propertyName];
            formatContext.propertyValue = val[propertyName];

            try {
                let prop = schema.info.properties[propertyName];
                if (schema.isSchemaReference(prop)) {
                    let propertyTypeName = prop.type;
                    if (prop.type === "any" && formatContext.propertyValue && formatContext.propertyValue._schema) {
                        propertyTypeName = formatContext.propertyValue._schema;
                    }
                    let errors2 = await this.validateReference(ctx, formatContext, prop.type, val);
                    if (errors2)
                        errors = Object.assign(errors, errors2);
                }
                else {
                    let err = await this.validateProperty(ctx, formatContext, val);
                    if (err) {
                        errors[propertyName] = err;
                    }
                }
            }
            catch (e) {
                errors[propertyName] = this.__formatMessage("Validation error for property {$propertyName} : " + e, formatContext);
            }
        }

        // Entity check
        if (schema.info.validate) {
            formatContext.propertyName = formatContext.propertySchema = formatContext.propertyValue = null;
            try {
                let err = await schema.info.validate(val, ctx);
                if (err)
                    errors["_"] = this.__formatMessage(err, formatContext, schema);
            }
            catch (e) {
                errors["_"] = this.__formatMessage("Validation error for element {_schema} : " + e, formatContext);
            }
        }
        return errors;
    }

    private async validateReference(ctx: IRequestContext, formatContext: FormatContext, propertyTypeName: string, entity): Promise<{ [propertyName: string]: string }> {
        let errors = {};

        const { propertySchema, propertyValue } = formatContext;

        if (!propertySchema)
            return errors;

        if (propertySchema.dependsOn && !propertySchema.dependsOn(entity))
            return errors;

        if (!propertyValue) {
            if (propertySchema.required) {
                errors[formatContext.propertyName] = this.__formatMessage(`Reference '{$propertyName}' is required.`, formatContext, propertySchema);
                return errors;
            }
            return null;
        }

        if (propertySchema.validators) {
            for (let validator of propertySchema.validators) {
                let msg = validator.validate && await validator.validate(propertyValue, ctx);
                if (msg) {
                    errors[formatContext.propertyName] = this.__formatMessage(msg, formatContext, propertySchema);
                    return errors;
                }
            }
        }

        let err = propertySchema.validate && await propertySchema.validate(propertyValue, ctx);
        if (err) {
            errors[formatContext.propertyName] = err;
            return errors;
        }

        let values = propertySchema.cardinality === "one" ? [propertyValue] : <Array<any>>propertyValue;

        let baseItemSchema = propertyTypeName && propertyTypeName !== "any" && this.domain.getSchema(propertyTypeName, true);

        for (let val of values) {
            if (val) {
                let currentItemSchema = baseItemSchema;
                if (val._schema && (!currentItemSchema || val._schema !== currentItemSchema.name)) {
                    currentItemSchema = this.domain.getSchema(val._schema, true);
                    if (!baseItemSchema)
                        baseItemSchema = currentItemSchema;
                }
                if (currentItemSchema) {
                    errors = Object.assign(errors, await this.validate(ctx, currentItemSchema, val, formatContext.propertyName + "."));
                }
            }
        }
        return errors;
    }

    private async validateProperty(ctx: IRequestContext, formatContext: FormatContext, entity): Promise<string> {
        const { propertySchema, propertyValue } = formatContext;

        if (propertySchema.dependsOn && !propertySchema.dependsOn(entity)) return;

        if (propertyValue === undefined || propertyValue === null) {
            if (propertySchema.required) {
                return this.__formatMessage(`Property '{$propertyName}' is required`, formatContext, propertySchema);
            }
            return null;
        }
        if (propertySchema.validators) {
            for (let validator of propertySchema.validators) {
                let err = validator.validate && await validator.validate(propertyValue, ctx);
                if (err) return this.__formatMessage(err, formatContext, validator);
            }
        }

        if (propertySchema.validate) {
            let err = await propertySchema.validate(propertyValue, ctx);
            if (err) return this.__formatMessage(err, formatContext, propertySchema);
        }
    }

    /**
     * Format an error message
     * @param message
     * @param ctx
     * @returns {string}
     * @private
     */
    private __formatMessage(message: string, ctx: FormatContext, validator?): string {
        const regex = /{\s*([^}\s]*)\s*}/g;
        return message.replace(regex, function (match, name) {
            switch (name) {
                case "$value":
                    return ctx.propertyValue;
                case "_schema":
                    return ctx.propertyName ? ctx.propertySchema : ctx.schemaElement;
                case "$id":
                    return ctx.id;
                case "$propertyName":
                    return ctx.propertyName;
                default:
                    if (!name) return null;
                    // Name beginning with $ belongs to schema
                    if (name[0] === "$" && validator) {
                        let p = validator[name] || validator[name.substring(1)];
                        return (typeof p === "function" && p(validator)) || p;
                    }
                    // Else it's an element's property
                    if (ctx.element) {
                        let p = ctx.element[name];
                        return (typeof p === "function" && p(ctx.element)) || p;
                    }
                    return null;
            }
        });
    }
}

interface FormatContext {
    id: string;
    element;
    schemaElement;
    propertyName?: string;
    propertySchema?;
    propertyValue?;
}
