import { Domain } from './schema';

import 'reflect-metadata'

export class SchemaBuilder {

    static build(domain:Domain, obj) {
        if(!obj) return null;
        let schema:any = {properties:{}, references:{}};
        schema.name = obj.name;

        const symModel = Symbol.for("design:model");
        let modelAttr = Reflect.getMetadata(symModel, obj);
        if (modelAttr) {
            for(let n of Object.keys( modelAttr)) {
                let p = modelAttr[n];
                if (typeof p === "function")
                    schema[n] = p.bind(schema);
                else {
                    schema[n] = p;
                }
            }
        }

        schema.storageName = schema.storageName || schema.name;

        const symProperties = Symbol.for("design:properties");
        let properties = Reflect.getOwnMetadata(symProperties, obj.prototype);
        for(let n in properties) {
            let propAttr = properties[n];
            if (propAttr) {
                if (!domain._findType(propAttr.type))
                    throw new Error(`Unknown type ${propAttr.type}`);

                if (propAttr.isKey) {
                    if (schema.idProperty)
                        throw new Error("Multiple property id is not valid for schema " + schema.name);
                    schema.idProperty = n;
                }
                if (schema.hasSensibleData === undefined) {
                    if (propAttr.sensible)
                        schema.hasSensibleData = true;
                }
                schema.properties[n] = propAttr;
                continue;
            }
        }
        if (!schema.idProperty) {
            if (schema.properties.id)
                schema.idProperty = "id";
            else if (schema.properties.name)
                schema.idProperty = "name"
        }
        
        const symReferences = Symbol.for("design:references");
        let references = Reflect.getOwnMetadata(symReferences, obj.prototype);
        for(let n in references) {
            let refAttr = references[n];
            if (refAttr) {
                let itemSchema;
                if (refAttr.item !== "any") {
                    itemSchema = domain.findSchemaDescription(refAttr.item);
                    if (!itemSchema)
                        throw new Error(`Unknown referenced schema ${refAttr.item}`);
                }

                schema.references[n] = refAttr;
                if (schema.hasSensibleData === undefined && itemSchema) {
                    if ( itemSchema.hasSensibleData)
                        schema.hasSensibleData = true;
                }
            }
        }

        return schema;
    }
}