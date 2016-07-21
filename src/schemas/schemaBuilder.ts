
import 'reflect-metadata'

export class SchemaBuilder {

    static build(obj) {
        if(!obj) return null;
        let schema:any = {properties:{}, references:{}};
        schema.name = obj.name;

        const symModel = Symbol.for("design:model");
        let modelAttr = Reflect.getMetadata(symModel, obj);
        if(modelAttr) {
            for(let n of Object.keys( modelAttr)) {
                let p = modelAttr[n];
                if(typeof p === "function")
                    schema[n] = p.bind(schema);
                else
                    schema[n] = p;
            }
        }

        schema.storageName = schema.storageName || schema.name;

        const symProperties = Symbol.for("design:properties");
        let properties = Reflect.getOwnMetadata(symProperties, obj.prototype);
        for(let n in properties) {
            let propAttr = properties[n];
            if (propAttr) {
                if (propAttr.isKey) {
                    if (schema.idProperty)
                        throw new Error("Multiple property id is not valid for schema " + schema.name);
                    schema.idProperty = n;
                }
                schema.properties[n] = propAttr;
                continue;
            }
        }
        if (!schema.idProperty) {
            if (schema.id)
                schema.idProperty = "id";
            else if (schema.name)
                schema.idProperty = "name"
            else
                throw new Error("No property id define for schema " + schema.name);
        }
        const symReferences = Symbol.for("design:references");
        let references = Reflect.getOwnMetadata(symReferences, obj.prototype);
        for(let n in references) {
            let refAttr = references[n];
            if(refAttr) {
                schema.references[n] = refAttr;
            }
        }

        return schema;
    }
}