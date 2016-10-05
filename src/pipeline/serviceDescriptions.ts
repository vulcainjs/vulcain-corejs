import { System } from 'vulcain-configurationsjs';
import { QueryManager } from './query';
import { Domain } from './../schemas/schema';
import {Schema} from '../schemas/schema';
import {EventNotificationMode, CommandManager} from './actions';
import {Injectable, LifeTime, Inject, DefaultServiceNames} from '../di/annotations';
import { Model } from './../schemas/annotations';

export class PropertyDescription {
    name: string;
    required: boolean;
    description: string;
    type: string;
    reference: "no" | "many" | "one";
}

export class SchemaDescription {
    name: string;
    properties: Array<PropertyDescription>;
}

export class ActionDescription {
    kind: "action" | "query" | "get";
    description: string;
    action: string;
    scope: string;
    inputSchema: string;
    outputSchema: string;
    verb: string;
}

@Model()
export class ServiceDescription {
    domain: string;
    serviceName: string;
    serviceVersion: string;
    services: Array<ActionDescription>;
    schemas: Array<SchemaDescription>;
}

export class ServiceDescriptors {
    private static natives = ["string", "String", "boolean", "Boolean", "number", "Number", "any", "Object"];
    private descriptions: ServiceDescription;
    private schemas = new Map<string, SchemaDescription>();

    constructor(@Inject(DefaultServiceNames.Domain) private domain: Domain) { }

    getAll() {
        if (this.descriptions) return this.descriptions;

        this.descriptions = {
            services: [],
            schemas: new Array<SchemaDescription>(),
            domain: this.domain.name,
            serviceName: System.serviceName,
            serviceVersion: System.serviceVersion
        };
        for (let item of CommandManager.commandHandlersFactory.handlers.values()) {

            let verb = !item.metadata.schema || CommandManager.commandHandlersFactory.isMonoSchema(this.domain.name)
                ? item.metadata.action
                : this.getSchemaDescription(item.metadata.schema) + "." + item.metadata.action;

            let desc: ActionDescription = {
                kind: "action",
                verb: verb,
                description: item.metadata.description,
                action: item.metadata.action,
                scope: item.metadata.scope,
                inputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.inputSchema),
                outputSchema: item.metadata.schema && this.getSchemaDescription(item.metadata.outputSchema)
            };
            this.descriptions.services.push(desc);
        }
        for (let item of QueryManager.handlerFactory.handlers.values()) {
            let schema = item.metadata.schema && this.getSchemaDescription(item.metadata.schema);
            if (item.metadata.action === "_serviceDescription") continue;

            let verb = !item.metadata.schema || CommandManager.commandHandlersFactory.isMonoSchema(this.domain.name)
                ? item.metadata.action
                : this.getSchemaDescription(item.metadata.schema) + "." + item.metadata.action;

            let desc: ActionDescription = {
                kind: item.metadata.action === "get" ? "get" : "query",
                verb: verb,
                description: item.metadata.description,
                action: item.metadata.action,
                scope: item.metadata.scope,
                inputSchema: item.metadata.inputSchema && this.getSchemaDescription(item.metadata.inputSchema),
                outputSchema: (item.metadata.outputSchema && this.getSchemaDescription(item.metadata.outputSchema)) || schema
            };
            if (desc.action === "get" && !desc.inputSchema)
                desc.inputSchema = "string";
            if (desc.action !== "get")
                desc.outputSchema = desc.outputSchema + "[]";
            this.descriptions.services.push(desc);
        }

        this.schemas = null;
        return this.descriptions;
    }

    private getSchemaDescription(schemaName: string | Function) {
        if (typeof schemaName === "string") {
            if( ServiceDescriptors.natives.indexOf(schemaName) >= 0) return schemaName;
            let type = this.getPropertyType(schemaName);
            if (type)
                return type.name;
        }

        let schema = this.domain.getSchema(schemaName);
        if (!schema)
            throw new Error("Unknow schema " + schemaName);

        let desc: SchemaDescription = this.schemas.get(schema.name);
        if (desc) return desc.name;

        desc = { name: schema.name, properties: [] };
        this.schemas.set(schema.name, desc);
        this.descriptions.schemas.push(desc);

        for (let k of Object.keys(schema.description.properties)) {
            const p = schema.description.properties[k];
            let type = this.getPropertyType(p.type);
            if (type) {
                let pdesc: PropertyDescription = <any>{ name: k, type: type.name, required: p.required, description: p.description };
                // Insert required at the beginning
                if (!pdesc.required)
                    desc.properties.push(pdesc);
                else
                    desc.properties.unshift(pdesc);
            }
        }
        for (let k of Object.keys(schema.description.references)) {
            const r = schema.description.references[k];
            if (this.schemas.has(r.name)) return r.name;
            this.getSchemaDescription(r.item);

            let pdesc: PropertyDescription = {
                name: k,
                reference: r.cardinality,
                type: r.item,
                required: r.required,
                description: r.description
            };
            // Insert required at the beginning
            if (!pdesc.required)
                desc.properties.push(pdesc);
            else
                desc.properties.unshift(pdesc);
        }
        return desc.name;
    }

    private getPropertyType(name: string) {
        while (true) {
            let type = this.domain._findType(name.toLowerCase());
            if (!type || !type.type) {
                if(type)
                    type.name = name.toLowerCase();
                return type;
            }
            name = type.type;
        }
    }
}