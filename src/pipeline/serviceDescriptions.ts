import { QueryManager } from './query';
import { Domain } from './../schemas/schema';
import {Schema} from '../schemas/schema';
import {EventNotificationMode, CommandManager} from './actions';
import {Injectable, LifeTime, Inject, DefaultServiceNames} from '../di/annotations';

export interface PropertyDescription {
    name: string;
    required: boolean;
    type: string;
    reference: "no" | "many" | "one";
}

export interface SchemaDescription {
    name: string;
    properties: Array<PropertyDescription>;
}

export interface ActionDescription {
    kind: "action" | "query";
    description: string;
    action: string;
    scope: string;
    schema: SchemaDescription;
    inputSchema: SchemaDescription;
    outputSchema: SchemaDescription;
}

export interface ServiceDescription {
    domain: string;
    services: Array<ActionDescription>;
    schemas: Map<string, SchemaDescription>;
}

export class ServiceDescriptors {

    private descriptions: ServiceDescription;

    constructor(@Inject(DefaultServiceNames.Domain) private domain: Domain) { }

    getAll() {
        if (this.descriptions) return this.descriptions;

        this.descriptions = { services: [], schemas: new Map<string, SchemaDescription>(), domain: this.domain.name };
        for (let item of CommandManager.commandHandlersFactory.handlers.values()) {
            let desc: ActionDescription = {
                kind: "action",
                description: item.metadata.description,
                action: item.metadata.action,
                scope: item.metadata.scope,
                schema: item.metadata.schema && this.getSchemaDescription(item.metadata.schema),
                inputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.inputSchema),
                outputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.outputSchema)
            };
            this.descriptions.services.push(desc);
        }
        for (let item of QueryManager.handlerFactory.handlers.values()) {
            let desc: ActionDescription = {
                kind: "query",
                description: item.metadata.description,
                action: item.metadata.action,
                scope: item.metadata.scope,
                schema: item.metadata.schema && this.getSchemaDescription(item.metadata.schema),
                inputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.inputSchema),
                outputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.outputSchema)
            };

            this.descriptions.services.push(desc);
        }
        return this.descriptions;
    }

    private getSchemaDescription(schemaName: string|Function) {
        let schema = this.domain.getSchema(schemaName);
        if (!schema)
            throw new Error("Unknow schema " + schemaName);

        let desc: SchemaDescription = this.descriptions.schemas.get(schema.name);
        if(desc) return desc;

        desc = { name: schema.name, properties: [] };
        this.descriptions.schemas.set(schema.name, desc);

        schema.description.properties.forEach(p => {
            let type = this.getPropertyType(p.name);
            if (type) {
                let pdesc: PropertyDescription = { name: p.name, reference: "no", type: type, required: p.required };
                // Insert required at the beginning
                if (!pdesc.required)
                    desc.properties.push(pdesc);
                else
                    desc.properties.unshift
            }
        });
        schema.description.references.forEach(r => {
            if (this.descriptions.schemas.has(r.name)) return;
            this.getSchemaDescription(r.item);

            let pdesc: PropertyDescription = {
                name: r.name,
                reference: r.cardinality,
                type: r.item,
                required: r.required
            };
            // Insert required at the beginning
            if (!pdesc.required)
                desc.properties.push(pdesc);
            else
                desc.properties.unshift
        });
        return desc;
    }

    private getPropertyType(name: string) {
        while (true) {
            let type = this.domain._findType(name);
            if (!type || !type.type) {
                return type;
            }
            name = type.type;
        }
    }
}