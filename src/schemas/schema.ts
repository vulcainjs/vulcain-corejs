import { SchemaBuilder } from './builder/schemaBuilder';
import { Validator } from './validator';
import { IContainer } from '../di/resolvers';
import { SchemaVisitor } from './visitor';
import { Service } from './../globals/system';
import { IRequestContext } from "../pipeline/common";
import { ModelPropertyDefinition, SchemaInfo } from './schemaInfo';
import { Domain } from './domain';
import { ModelDefinition } from './builder/annotations.model';
import { ISchemaTypeDefinition } from './schemaType';
import { Reflector } from '../utils/reflector';

/**
 * Schema definition
 */
export class Schema {
    private _subModels: Schema[];
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
    constructor(private domain: Domain, def: ModelDefinition, public readonly schemaType) {
        this.info = {
            name: def.name,
            storageName: def.storageName,
            hasSensibleData: def.hasSensibleData,
            properties: {},
            coerce: def.coerce,
            validate: def.validate,
            metadata: Reflector.getMetadata(schemaType),
            extends: def.extends,
            isInputModel: def.inputModel
        };

        let superModel = this.extends;
        if (superModel) {
            superModel._subModels = superModel._subModels || [];
            superModel._subModels.push(this);
        }
    }

    public *subModels(all = true): IterableIterator<Schema> {
        if (this._subModels) {
            for (let sm of this._subModels) {
                yield sm;
                if(all)
                    yield* sm.subModels();
            }
        }    
    }

    findProperty(name: string) {
        for (let prop of this.allProperties()) {
            if (prop.name === name)
                return prop;    
        }
        return undefined;
    }
    
    public *properties() {
        for (let p in this.info.properties) {
            yield this.info.properties[p];
        }
    }

    public *allProperties(): IterableIterator<ModelPropertyDefinition> {
        let ext = this.extends;
        if (ext) {
            yield* ext.allProperties();
        }
        yield* this.properties();
    }

    coerce(data) {
        return this.coerceInternal(data, this);
    }

    private coerceInternal(entity, schema: Schema, result?)
    {
        if (!entity) { return null; }
        if (typeof schema.info.coerce === "function") {
            return schema.info.coerce(entity);
        }

        if (typeof entity !== "object") {
            return entity;
        }

        result = result || new schema.schemaType(); //origin;

        (<any>result)._schema = (<any>result)._schema || schema.name;

        // Convert properties
        for (const propertyDefinition of schema.properties()) {

            if (propertyDefinition) {
                try {
                    if (this.isSchemaReference(propertyDefinition)) { 
                        let itemSchemaName = propertyDefinition.type;
                        let itemValue = entity[propertyDefinition.name];

                        if (Array.isArray(itemValue)) {
                            result[propertyDefinition.name] = [];
                            for (let elem of itemValue) {
                                if (elem && elem._schema) {
                                    itemSchemaName = elem._schema;
                                }

                                let elemSchema = this.domain.getSchema(itemSchemaName, true);
                                if (!elemSchema && itemSchemaName !== "any") {
                                    continue;
                                }
                                let val = this.applyBinding(propertyDefinition, entity, elem);
                                if (val !== undefined) {
                                    result[propertyDefinition.name].push(!elemSchema ? val : this.coerceInternal(val, elemSchema));
                                }
                            }
                        }
                        else {
                            if (itemValue && itemValue._schema) {
                                itemSchemaName = itemValue._schema;
                            }

                            let elemSchema = this.domain.getSchema(itemSchemaName, true);
                            if (!elemSchema && itemSchemaName !== "any") {
                                continue;
                            }

                            let val = this.applyBinding(propertyDefinition, entity, itemValue);
                            if (val !== undefined) {
                                result[propertyDefinition.name] = !elemSchema ? val : this.coerceInternal(val, elemSchema);
                            }
                        }
                    }
                    else {
                        let val = this.applyBinding(propertyDefinition, entity, entity[propertyDefinition.name]);

                        if (val !== undefined) {
                            result[propertyDefinition.name] = val;
                        }
                    }
                }
                catch (e) {
                        // ignore
                }
            }
        }

        if (schema.extends) {
            this.coerceInternal(entity, schema.extends, result);
        }
        return result;
    }

    private applyBinding(prop, origin, val) {
        let mainTypeValidator = prop.validators[prop.validators.length - 1];
        if (mainTypeValidator["coerce"] === false) { return undefined; }// skip value

        for (let validator of prop.validators) {
            let convert = validator["coerce"];
            if (convert === false) { continue; }

            if (convert && typeof convert === "function") {
                val = convert.apply(prop, [val, origin]);
            }
        }
        return val;
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
            visitProperty(val, prop: ModelPropertyDefinition) {
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

    isSchemaReference(prop: ModelPropertyDefinition) {
        return prop && prop.cardinality && !prop.itemsType;
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
                if (this.isSchemaReference(ref)) {
                    let item = ref.type;
                    if (val && val._schema) {
                        item = val._schema;
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

