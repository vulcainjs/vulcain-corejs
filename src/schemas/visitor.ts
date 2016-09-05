import {Domain} from './schema';

export interface IVisitor {
    visitEntity(obj, schema): boolean;
    visitProperty(val, schema);
}

export class SchemaVisitor {

    constructor(private domain:Domain, private visitor: IVisitor) {
    }

    private resolveSchema(schemaName) {
        let schema = schemaName;

        if (typeof schemaName === "string") {
            schemaName = schemaName;
            schema = this.domain.findSchemaDescription(schemaName);
            if (!schema) return;
        }
        else {
            if (!schema) return;
            schema = schema.description || schema;
        }
        return schema;
    }

    visit(schemaName, entity) {

        let schema = this.resolveSchema(schemaName);

        if (this.visitor.visitEntity && !this.visitor.visitEntity(entity, schema))
            return;

        let sch = schema;
        while (sch) {
            for (const ps in sch.properties) {
                if (!sch.properties.hasOwnProperty(ps)) continue;
                let prop = sch.properties[ps];
                if (prop) {
                    prop.name = ps;
                    let val = entity[ps];
                    this.visitor.visitProperty && this.visitor.visitProperty(val, prop);
                }
            }
            sch = sch.extends && this.resolveSchema( sch.extends );
        }

        sch = schema;
        while (sch) {
            for (const ref in schema.references) {
                if (!schema.references.hasOwnProperty(ref)) continue;
                let relationshipSchema = schema.references[ref];
                let refValue = entity[ref];
                if (relationshipSchema && refValue) {
                    let item = relationshipSchema.item;
                    if (item === "any" && refValue && refValue.__schema) {
                        item = refValue.__schema;
                    }
                    let elemSchema = this.domain.findSchemaDescription(item);
                    if (!elemSchema && item !== "any") {
                        continue;
                    }

                    elemSchema.name = ref;
                    if (Array.isArray(refValue)) {
                        for (let elem of refValue) {
                            this.visit(elemSchema, elem);
                        }
                    }
                    else {
                        this.visit(elemSchema, refValue);
                    }
                }
            }
            sch = sch.extends && this.resolveSchema(sch.extends);
        }
    }
}