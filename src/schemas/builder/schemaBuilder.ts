import 'reflect-metadata';
import { ModelOptions } from './annotations.model';
import { Domain } from '../domain';
import { Schema } from '../schema';
import { ModelPropertyInfo } from '../schemaInfo';
import { ISchemaValidation, ISchemaTypeDefinition } from '../schemaType';

export class SchemaBuilder {
    private static properties = new Map<string, ModelPropertyInfo[]>();

    static addProperty(modelName: string, info: ModelPropertyInfo) {
        let properties = SchemaBuilder.properties.get(modelName) || [];
        properties.push(info);
        SchemaBuilder.properties.set(modelName, properties);
    }

    static buildSchema(domain: Domain, options: ModelOptions, type: Function) {
        let schema = new Schema(domain, options, type);
        let properties = SchemaBuilder.properties.get(name) || [];

        for (let propertyName in properties) {
            let propInfo: ModelPropertyInfo = properties[propertyName];
            if (propInfo) {
                if (propInfo.type !== "any") {
                    const propertyType = domain.getType(propInfo.type);
                    if (!propertyType) {
                        const propertySchema = domain.getSchema(propInfo.type, true);
                        if(!propertySchema)
                            throw new Error(`Unknown type '${propInfo.type}' for property ${propertyName} of schema ${name}`);

                        schema.info.cardinality = schema.info.cardinality || "one";
                        if (!schema.info.hasSensibleData && propertySchema) {
                            if (propertySchema.info.hasSensibleData)
                                schema.info.hasSensibleData = true;
                        }
                        propInfo.validators = SchemaBuilder.createValidatorsChain(domain, "$ref", propInfo, propertyName, schema.schemaType);
                    }
                    else {
                        propInfo.validators = SchemaBuilder.createValidatorsChain(domain, propInfo.type, propInfo, propertyName, schema.schemaType);
                    }
                }

                if (propInfo.isKey) {
                    if (schema.getIdProperty())
                        throw new Error("Multiple property id is not valid for schema " + name);
                    schema.info.idProperty = propertyName;
                }

                if (!schema.info.hasSensibleData) {
                    if (propInfo.sensible)
                        schema.info.hasSensibleData = true;
                }

                schema.info.properties[propertyName] = propInfo;
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
                let stype = domain.getSchema(stypeName, true);
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
                let validator = domain.getSchema(info.name, true);
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
