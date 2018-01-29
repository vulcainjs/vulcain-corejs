import { SchemaBuilder } from './builder/schemaBuilder';
import { Validator } from './validator';
import { IContainer } from '../di/resolvers';
import { SchemaVisitor } from './visitor';
import { Service } from './../globals/system';
import { IRequestContext } from "../pipeline/common";
import { ModelPropertyInfo, SchemaInfo } from './schemaInfo';
import { Domain } from './domain';
import { ModelOptions } from './builder/annotations.model';
import { ISchemaTypeDefinition } from './schemaType';

/**
 * Schema definition
 */
export class Schema {
    public readonly info: SchemaInfo;

    public get name() { return this.info.name; }

    get extends(): Schema {
        if (!this.info.extends) {
            return null;
        }
        return this.domain.getSchema(this.info.extends);
    }

    /**
     * Create a new schema
     */
    constructor(private domain: Domain, options: ModelOptions, public readonly schemaType) {
        this.info = {
            name: options.name,
            storageName: options.storageName,
            hasSensibleData: options.hasSensibleData,
            properties: {},
            bind: options.bind,
            validate: options.validate,
            custom: options.custom,
            extends: options.extends
        };
    }

    bind(data) {
        return this.bindInternal(data, this);
    }

    private bindInternal(data, schema: Schema, result?)
    {
        if (!data) { return null; }
        if (typeof schema.info.bind === "function") {
            return schema.info.bind(data);
        }

        if (typeof data !== "object") {
            return data;
        }

        result = result || new schema.schemaType(); //origin;

        (<any>result).__schema = (<any>result).__schema || schema.name;

        // Convert properties
        for (const propertyName in schema.info.properties) {
            if (!schema.info.properties.hasOwnProperty(propertyName)) { continue; }
            let prop = schema.info.properties[propertyName];
            
            if (prop) {
                try {
                    if (prop.cardinality) {
                        let item = prop.type;
                        let refValue = data[propertyName];

                        if (item === "any" && refValue && refValue.__schema) {
                            item = refValue.__schema;
                        }

                        let elemSchema = this.domain.getSchema(item, true);
                        if (!elemSchema && item !== "any") {
                            continue;
                        }

                        if (this.isMany(prop)) {
                            result[propertyName] = [];
                            for (let elem of refValue) {
                                let val = this.applyBinding(prop, elemSchema, elem);
                                if (val !== undefined) {
                                    result[propertyName].push(!elemSchema && item === "any" ? val : this.bindInternal(val, elemSchema));
                                }
                            }
                        }
                        else {
                            let val = this.applyBinding(prop, elemSchema, refValue);
                            if (val !== undefined) {
                                result[propertyName] = !elemSchema && item === "any" ? val : this.bindInternal(val, elemSchema);
                            }
                        }
                    }
                    else {
                        let val = this.applyBinding(prop, data, data[propertyName]);

                        if (val !== undefined) {
                            result[propertyName] = val;
                        }
                    }
                }
                catch (e) {
                        // ignore
                }
            }
        }

        if (schema.extends) {
            this.bindInternal(data, schema.extends, result);
        }
        return result;
    }

    private applyBinding(prop, origin, val) {
        let mainTypeValidator = prop.validators[prop.validators.length - 1];
        if (mainTypeValidator["bind"] === false) { return undefined; }// skip value

        for (let validator of prop.validators) {
            let convert = validator["bind"];
            if (convert === false) { continue; }

            if (convert && typeof convert === "function") {
                val = convert.apply(prop, [val, origin]);
            }
        }
        return val;
    }

    private isMany(relSchema) {
        return relSchema.cardinality === "many";
    }

    validate(ctx: IRequestContext, obj) {
        let validator = new Validator(this.domain);
        return validator.validate(ctx, this, obj);
    }

    getIdProperty() {
        let schema: Schema = this;
        while (schema) {
            if (schema && schema.info.idProperty) {
                return schema.info.idProperty;
            }
            schema = schema.extends;
        }
        return null;
    }

    getId(obj) {
        return obj[this.getIdProperty()];
    }

    encrypt(entity) {
        if (!entity || !this.info.hasSensibleData) {
            return entity;
        }
        let visitor = {
            visitEntity(entity, schema: Schema) { this.current = entity; return schema.info.hasSensibleData; },
            visitProperty(val, prop: ModelPropertyInfo) {
                if (val && prop.sensible) {
                    this.current[prop.name] = Service.encrypt(val);
                }
            }
        };
        let v = new SchemaVisitor(this.domain, visitor);
        v.visit(this, entity);
        return entity;
    }

    decrypt(entity) {
        if (!entity || !this.info.hasSensibleData) {
            return entity;
        }

        let visitor = {
            visitEntity(entity, schema: Schema) { this.current = entity; return schema.info.hasSensibleData; },
            visitProperty(val, prop) {
                if (val && prop.sensible) {
                    this.current[prop.name] = Service.decrypt(val);
                }
            }
        };
        let v = new SchemaVisitor(this.domain, visitor);
        v.visit(this, entity);
        return entity;
    }

    /**
 * Remove all sensible data
 *
 * @param {any} entity
 * @returns
 */
    obfuscate(entity) {
        let visitor = {
            visitEntity(entity, schema) { this.current = entity; return schema.info.hasSensibleData; },
            visitProperty(val, prop) { if (prop.sensible) { this.current[prop.name] = undefined; } }
        };
        let v = new SchemaVisitor(this.domain, visitor);
        v.visit(this, entity);
    }

    /**
     * Copy an entity to another taking into account references defined in schema
     *
     * @param {any} target
     * @param {any} source
     * @param {SchemaDescription} [schema]
     * @returns
     *
     * @memberOf Schema
     */
    deepAssign(target, source, schema?: Schema) {
        if (!source) {
            return target;
        }
        if (!(typeof source === "object")) {
            return source;
        }

        schema = schema || this;
        for (let key of Object.keys(source)) {
            let val = source[key];
            if (typeof val === "object") {
                let ref = schema.info.properties[key];
                if (ref && ref.cardinality) {
                    let item = ref.type;
                    if (item === "any" && val && val.__schema) {
                        item = val.__schema;
                    }
                    let elemSchema = this.domain.getSchema(item, true);
                    if (elemSchema) {
                        if (Array.isArray(val)) {
                            target[key] = [];
                            val.forEach(v => target[key].push(this.deepAssign({}, v, elemSchema)));
                        }
                        else {
                            target[key] = this.deepAssign(target[key] || {}, val, elemSchema);
                        }
                        continue;
                    }
                }
            }
            if (val !== undefined) {
                target[key] = val;
            }
        }
        return target;
    }
}

