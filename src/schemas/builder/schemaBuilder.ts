import 'reflect-metadata';
import { ModelOptions } from './annotations.model';
import { Domain } from '../domain';
import { Schema } from '../schema';
import { ModelPropertyInfo } from '../schemaInfo';
import { ISchemaValidation, ISchemaTypeDefinition } from '../schemaType';

export class SchemaBuilder {

    static buildSchema(domain: Domain, options: ModelOptions, type: Function) {
        let schema = new Schema(domain, options, type);
        const sym = Symbol.for("design:properties");

        const properties = Reflect.getOwnMetadata(sym, type.prototype) || [];

        for (let property of properties) {
            if (property) {
                if (property.type !== "any") {
                    const propertyType = domain.getType(property.type);
                    if (!propertyType) {
                        const propertySchema = domain.getSchema(property.type, true);
                        if(!propertySchema)
                            throw new Error(`Unknown type '${property.type}' for property ${property.name} of schema ${name}`);

                        schema.info.cardinality = schema.info.cardinality || "one";
                        if (!schema.info.hasSensibleData && propertySchema) {
                            if (propertySchema.info.hasSensibleData)
                                schema.info.hasSensibleData = true;
                        }
                        property.validators = SchemaBuilder.createValidatorsChain(domain, "$ref", property, property.name, schema.schemaType);
                    }
                    else {
                        property.validators = SchemaBuilder.createValidatorsChain(domain, property.type, property, property.name, schema.schemaType);
                    }
                }

                if (property.isKey) {
                    if (schema.getIdProperty())
                        throw new Error("Multiple property id is not valid for schema " + name);
                    schema.info.idProperty = property.name;
                }

                if (!schema.info.hasSensibleData) {
                    if (property.sensible)
                        schema.info.hasSensibleData = true;
                }

                schema.info.properties[property.name] = property;
            }
        }

        if (!schema.info.idProperty) {
            if (schema.info.properties["id"])
                schema.info.idProperty = "id";
        }

        domain.addSchema(schema);
    }

    private static createValidatorsChain(domain: Domain, typeName: string, attributeInfo, propertyName: string, obj) {
        let chain = [];
        const symValidators = Symbol.for("design:validators");

        let type = domain.getType(typeName);
        if (type) {
            let clonedType = SchemaBuilder.clone(type, attributeInfo);
            for (let fn of ["bind", "dependsOn", "validate"]) {
                if (attributeInfo[fn]) {
                    clonedType[fn] = attributeInfo[fn];
                }
            }

            // Type inheritence (in reverse order)
            let stypeName = clonedType.type;
            while (stypeName) {
                let stype = domain.getType(stypeName);
                if (!stype)
                    break;
                chain.unshift(SchemaBuilder.clone(stype, attributeInfo));
                stypeName = (<any>stype).type;
            }
            // Then type
            chain.push(clonedType);
        }

        // And validator
        let validators = Reflect.getOwnMetadata(symValidators, obj.prototype, propertyName);
        if (validators) {
            for (let info of validators) {
                let validator = domain.getType(info.name);
                if (!validator)
                    throw new Error(`Unknow validator ${info.name}`);
                else
                    chain.push(SchemaBuilder.clone(validator, info.options));
            }
        }
        return chain;
    }

    // Copy all schema property names from 'from'
    static clone(schema, from, clone?): ISchemaValidation {
        clone = clone || Object.create(Object.getPrototypeOf( schema));
        for (let key of Object.keys(schema)) {
            if (key && key[0] === "$") {
                let pname = key.substr(1);
                clone[key] = (from && from[pname]) || schema[key];
            }
            else {
                clone[key] = schema[key];
            }
        }
        if (from.custom) {
            clone = SchemaBuilder.clone(schema, from.custom, clone);
        }

        return clone;
    }
}
