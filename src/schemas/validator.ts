import { Domain, SchemaDescription, ErrorMessage } from './schema';
import { IContainer } from '../di/resolvers';
import { RequestContext } from '../servers/requestContext';

export class Validator {

    constructor(private domain: Domain, private container: IContainer) {
    }

    async validateAsync(ctx: RequestContext, schemaDesc: SchemaDescription, val) {
        let errors: Array<ErrorMessage> = [];
        if (!schemaDesc || !val) return errors;

        if (schemaDesc.extends) {
            let base = this.domain.resolveSchemaDescription(schemaDesc.extends);
            if (base) {
                (await this.validateAsync(ctx, base, val)).forEach(e => { errors.push(e); });
            }
        }

        let id = val && val[this.domain.getIdProperty(schemaDesc)];
        let formatContext: FormatContext = { element: val, schemaElement: schemaDesc, id: id };

        // Properties checks
        for (const ps in schemaDesc.properties) {
            if (!schemaDesc.properties.hasOwnProperty(ps)) continue;
            formatContext.propertyName = ps;
            formatContext.propertySchema = schemaDesc.properties[ps];
            formatContext.propertyValue = val[ps];

            try {
                let err = await this.validatePropertyAsync(ctx, formatContext, schemaDesc.properties[ps], val[ps], val);
                if (err) {
                    errors.push({ message: err, property: ps, id: formatContext.id });
                }
            }
            catch (e) {
                errors.push({ message: this.__formatMessage("Validation error for property {$propertyName} : " + e, formatContext), id: formatContext.id, property: ps });
            }
        }

        // References checks
        for (const rs in schemaDesc.references) {
            if (!schemaDesc.references.hasOwnProperty(rs)) continue;
            formatContext.propertyName = rs;
            formatContext.propertySchema = schemaDesc.references[rs];
            formatContext.propertyValue = val[rs];

            try {
                let ref = schemaDesc.references[rs];
                if (ref.item === "any" && formatContext.propertyValue && formatContext.propertyValue.__schema) {
                    if (ref && ref.dependsOn && !ref.dependsOn(val)) continue;
                    let schema = this.domain.getSchema(formatContext.propertyValue.__schema);
                    if (!schema) continue;
                    errors = errors.concat(await this.validateAsync(ctx, schema.description, formatContext.propertyValue));
                }
                else {
                    let errors2 = await this.validateReferenceAsync(ctx, formatContext, ref, val[rs], val);
                    if(errors2)
                        errors = errors.concat(errors2);
                }
            }
            catch (e) {
                errors.push({ message: this.__formatMessage("Validation error for reference {$propertyName} : " + e, formatContext), id: formatContext.id, property: rs });
            }
        }

        // Entity check
        if (schemaDesc.validate) {
            formatContext.propertyName = formatContext.propertySchema = formatContext.propertyValue = null;
            try {
                let err = await schemaDesc.validate(val, ctx);
                if (err)
                    errors.push({ message: this.__formatMessage(err, formatContext, schemaDesc), id: formatContext.id });
            }
            catch (e) {
                errors.push({ message: this.__formatMessage("Validation error for element {__schema} : " + e, formatContext), id: formatContext.id });
            }
        }
        return errors;
    }

    private async validateReferenceAsync(ctx: RequestContext, formatContext: FormatContext, schema, val, entity): Promise<Array<ErrorMessage>> {
        if (!schema)
            return;

        if (schema.dependsOn && !schema.dependsOn(entity))
            return;

        if (!val) {
            if (schema.required) {
                return [{
                    message: this.__formatMessage("Reference '{$propertyName}' is required.", formatContext, schema),
                    id: formatContext.id,
                    property: formatContext.propertyName
                }];
            }
            return null;
        }

        if (schema.validators) {
            for (let validator of schema.validators) {
                let msg = validator.validate && await validator.validate( val, ctx );
                if (msg)
                return [{
                    message: this.__formatMessage(msg, formatContext, schema),
                    id: formatContext.id,
                    property: formatContext.propertyName
                }];
            }
        }

        let err = schema.validate && await schema.validate(val, ctx);
        if (err) return [err];

        let values = schema.cardinality === "one" ? [val] : <Array<any>>val;

        let baseItemSchema = schema.item && this.domain.getSchema(schema.item, true);
        let errors = [];

        for (let val of values) {
            if (val) {
                let currentItemSchema = baseItemSchema;
                if (val.__schema && (!currentItemSchema || val.__schema !== currentItemSchema.name)) {
                    currentItemSchema = this.domain.getSchema(val.__schema, true);
                    if (!baseItemSchema)
                        baseItemSchema = currentItemSchema;
                }
                if (currentItemSchema) {
                    errors = errors.concat(await this.validateAsync(ctx, currentItemSchema.description, val));
                }
            }
        }
        return errors;
    }

    private async validatePropertyAsync(ctx: RequestContext, formatContext: FormatContext, schema: string | any, val, entity): Promise<string> {
        if (typeof schema === "string") {
            let type = this.domain._findType(<string>schema);
            if (!type) {
                return null;
            }
            schema = type;
        }

        if (schema.dependsOn && !schema.dependsOn(entity)) return;

        if (val === undefined || val === null) {
            if (schema.required) {
                return this.__formatMessage("Property '{$propertyName}' is required.", formatContext, schema);
            }
            return null;
        }
        if (schema.validators) {
            for (let validator of schema.validators) {
                let err = validator.validate && await validator.validate(val, ctx);
                if (err) return this.__formatMessage(err, formatContext, validator);
            }
        }

        if (schema.validate) {
            let err = await schema.validate( val, ctx );
            if (err) return this.__formatMessage(err, formatContext, schema);
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
                case "$schema":
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
