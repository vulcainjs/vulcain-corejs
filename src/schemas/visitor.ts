import { Domain } from "./domain";
import { Schema } from "./schema";


export interface IVisitor {
    visitEntity(obj, schema): boolean;
    visitProperty(val, schema);
}

export class SchemaVisitor {

    constructor(private domain:Domain, private visitor: IVisitor) {
    }

    visit(schema: Schema, entity) {

        if (this.visitor.visitEntity && !this.visitor.visitEntity(entity, schema))
            return;

        let sch = schema;
        while (sch) {
            for (const ps in sch.info.properties) {
                if (!sch.info.properties.hasOwnProperty(ps)) continue;
                let prop = sch.info.properties[ps];
                if (prop) {
                    if (schema.isEmbeddedReference(prop)) {
                        let refValue = entity[ps];
                        if (refValue) {
                            let item = prop.type;
                            if (refValue && refValue._schema) {
                                item = refValue._schema;
                            }
                            let elemSchema = item && this.domain.getSchema(item, true);
                            if (!elemSchema) {
                                continue;
                            }

                          //  elemSchema.name = ref;
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
                    else {
                        (<any>prop).name = ps;
                        let val = entity[ps];
                        this.visitor.visitProperty && this.visitor.visitProperty(val, prop);
                    }
                }
            }
            sch = sch.extends;
        }
    }
}