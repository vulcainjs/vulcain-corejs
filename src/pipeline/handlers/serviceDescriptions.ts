import { Domain, SchemaDescription as schDesc } from '../../schemas/schema';
import { ActionMetadata } from './actions';
import { LifeTime, Inject, DefaultServiceNames } from '../../di/annotations';
import { Model } from '../../schemas/annotations';
import { IContainer } from '../../di/resolvers';
import { ServiceHandlerMetadata, CommonActionMetadata } from './common';
import { QueryActionMetadata } from './query';
import { Service } from '../../globals/system';
import { ApplicationError } from '../errors/applicationRequestError';
import { ScopesDescriptor } from "../../defaults/scopeDescriptors";

export interface HandlerItem {
    methodName: string;
    handler: Function;
    metadata: CommonActionMetadata;
    kind: "action" | "query" | "event";
    verb?: string;
}

export class PropertyDescription {
    name: string;
    required: boolean;
    description: string;
    type: string;
    typeDescription: string;
    reference?: "no" | "many" | "one";
    metadata: any;
    order: number;
    custom?: any
}

export class SchemaDescription {
    name: string;
    idProperty: string;
    properties: Array<PropertyDescription>;
    dependencies: Set<string>;
    custom?: any;
}

export class ActionDescription {
    schema: string;
    kind: "action" | "query" | "get";
    description: string;
    action: string;
    scope: string;
    inputSchema: string;
    outputSchema: string;
    outputType?: string;
    verb: string;
    async: boolean;
}

@Model()
export class ServiceDescription {
    domain: string;
    serviceName: string;
    serviceVersion: string;
    alternateAddress?: string;
    services: Array<ActionDescription>;
    schemas: Array<SchemaDescription>;
    hasAsyncTasks: boolean;
    scopes: Array<{ name: string, description: string }>;
}

export class ServiceDescriptors {
    static nativeTypes = ["string", "String", "boolean", "Boolean", "number", "Number", "any", "Object"];
    private descriptions: ServiceDescription;
    private handlers = new Array<HandlerItem>();
    private routes = new Map<string, HandlerItem>();
    private defaultSchema: string;

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) {
    }

    getDescriptions() {
        this.createHandlersTable();
        return this.descriptions;
    }

    getHandlerInfo(container: IContainer|undefined, schema: string, action: string, optional?: boolean) {
        this.createHandlersTable();

        let verb = action && action.toLowerCase();
        let item: HandlerItem|undefined;

        if (!schema) {
            item = this.routes.get(verb);
            if (!item) {
                schema = this.defaultSchema;
            }
        }

        if (schema) {
            let s = schema.toLowerCase();
            verb = s + "." + verb;
            item = this.routes.get(verb);
        }

        if (!item) {
            if (optional)
                return null;
            else
                throw new ApplicationError(`no handler method founded for action ${action}, schema ${schema}`, 405);
        }

        try {
            let handler = container && container.resolve(item.handler);
            return { handler: handler, metadata: item.metadata, method: item.methodName, verb: verb, kind: item.kind };
        }
        catch (e) {
            Service.log.error(null, e, ()=>`Unable to create handler action ${action}, schema ${schema}`);
            throw new Error(`Unable to create handler for action ${action}, schema ${schema}`);
        }
    }

    createHandlersTable() {
        if (!this.handlers)
            return;

        let scopes = this.container.get<ScopesDescriptor>(DefaultServiceNames.ScopesDescriptor);

        let schemas = new Map<string, SchemaDescription>();

        // Check if there is only one Schema
        let lastSchema: string|undefined;
        let monoSchema = true;
        this.handlers.forEach(item => {
            if (!item.metadata.schema)
                return;
            if (!lastSchema)
                lastSchema = <string>item.metadata.schema;
            else if (item.metadata.schema !== lastSchema) {
                monoSchema = false;
            }
        });
        if (monoSchema && lastSchema) {
            this.defaultSchema = lastSchema;
        }

        this.descriptions = {
            services: [],
            schemas: new Array<SchemaDescription>(),
            domain: this.domain.name,
            serviceName: Service.serviceName || "unknown",
            serviceVersion: Service.serviceVersion || "",
            alternateAddress: undefined,
            hasAsyncTasks: false,
            scopes: scopes.getScopes().map(d => { return { name: d.name, description: d.description }; })
        };

        for (let item of this.handlers.filter(h => h.kind === "action")) {
            let schema = item.metadata.schema && this.getSchemaDescription(schemas, item.metadata.schema);

            let verb = !schema
                ? item.metadata.action
                : schema + "." + item.metadata.action;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for action ${item.metadata.action} for handler ${item.handler.name}`);

            Service.log.info(null, ()=> `Handler registered for action verb ${verb}`);
            this.routes.set(verb, item);
            item.verb = verb;

            let metadata = <ActionMetadata>item.metadata;
            metadata.scope = this.checkScopes(scopes, metadata, verb);
            metadata.inputSchema = this.getSchemaDescription(schemas, metadata.inputSchema, schema);
            metadata.outputSchema = !metadata.async && this.getSchemaDescription(schemas, metadata.outputSchema, schema);

            let desc: ActionDescription = {
                schema: schema,
                kind: "action",
                async: metadata.async,
                verb: verb,
                description: metadata.description,
                action: metadata.action,
                scope: metadata.scope,
                inputSchema: <string>metadata.inputSchema,
                outputSchema: <string>metadata.outputSchema
            };

            if (metadata.async)
                this.descriptions.hasAsyncTasks = true;

            this.descriptions.services.push(desc);
        }

        for (let item of this.handlers.filter(h => h.kind === "query")) {

            let schema = item.metadata.schema && this.getSchemaDescription(schemas, item.metadata.schema);

            let verb = !item.metadata.schema
                ? item.metadata.action
                : schema + "." + item.metadata.action;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for query ${item.metadata.action} for handler ${item.handler.name}`);

            Service.log.info(null, ()=> `Handler registered for query verb ${verb}`);
            this.routes.set(verb, item);
            item.verb = verb;

            if (item.metadata.action.startsWith("_service")) continue;

            let metadata = <QueryActionMetadata>item.metadata;
            metadata.inputSchema = this.getSchemaDescription(schemas, metadata.inputSchema);
            metadata.outputSchema = this.getSchemaDescription(schemas, metadata.outputSchema, schema);
            metadata.scope = this.checkScopes(scopes, metadata, verb);

            let desc: ActionDescription = {
                schema: schema,
                kind: metadata.action === "get" ? "get" : "query",
                verb: verb,
                outputType: metadata.outputType || metadata.action === "get" ? "one" : "many",
                description: metadata.description,
                action: metadata.action,
                scope: metadata.scope,
                async: false,
                inputSchema: <string>metadata.inputSchema,
                outputSchema: <string>metadata.outputSchema
            };

            if (desc.action === "get" && !desc.inputSchema)
                desc.inputSchema = "string";
            if (desc.action !== "get")
                desc.outputSchema = desc.outputSchema;
            this.descriptions.services.push(desc);
        }

        this.sortSchemasDependencies();
        this.handlers = null;
    }

    private checkScopes(scopes: ScopesDescriptor, metadata: CommonActionMetadata, verb: string): string {
        let scope = metadata.scope;
        if (!scope || scope === "?" || scope === "*") return scope;

        if (scope === '.') {
            scope = Service.domainName + ":" + verb.replace('.', ':');
            if (!scopes.getScopes().find(s => s.name === scope)) {
                scopes.defineScope(scope, metadata.description);
            }
            return scope;
        }

        let parts = scope.split(',');
        let result = [];
        for (let sc of parts) {
            sc = Service.domainName + ":" + sc.trim();
            if (!scopes.getScopes().find(s => s.name === sc)) {
                //throw new Error(`${sc} not found in scopes descriptor for ${verb}. You must define it in (Startup)application.defineScopes.`);
                scopes.defineScope(sc, 'Generated description for ' + metadata.description);
            }
            result.push(sc);
        }
        return result.join(',');
    }

    private getSchemaDescription(schemas: Map<string, SchemaDescription>, schemaName: string | Function, defaultValue?: string): string {
        if (schemaName === "none")
            return;
        if (!schemaName)
            return defaultValue;

        let schema = this.domain.getSchema(schemaName, true);
        if (!schema) {
            if (typeof schemaName === "string") {
               // if (ServiceDescriptors.nativeTypes.indexOf(schemaName) >= 0) return schemaName;
                let type = this.getPropertyType(schemaName);
                if (type)
                    return type.name;
            }
            if (!schema)
                throw new Error("Unknown schema " + schemaName);
        }

        let desc: SchemaDescription = schemas.get(schema.name);
        if (desc) return desc.name;

        desc = {
            name: schema.name,
            properties: [],
            idProperty: schema.description.idProperty,
            dependencies: new Set<string>(),
            custom: schema.description.custom
        };
        schemas.set(schema.name, desc);
        this.descriptions.schemas.push(desc);
        let sd = schema.description;
        while (sd) {
            this.updateDescription(schemas, sd, desc);
            sd = this.domain.findSchemaDescription(sd.extends);
        }
        return desc.name;
    }

    private addDescription(desc: SchemaDescription, pdesc: PropertyDescription) {
        // find position
        let idx = desc.properties.findIndex(p => p.order > pdesc.order);
        if (idx === -1) {
            desc.properties.push(pdesc);
        }
        else {
            desc.properties.splice(idx, 0, pdesc);
        }
    }

    private updateDescription(schemas: Map<string, SchemaDescription>, schema: schDesc, desc: SchemaDescription) {
        for (let k of Object.keys(schema.properties)) {
            const p = schema.properties[k];
            let type = this.getPropertyType(p.items || p.type);
            if (type) {
                let metadata = { type: p.type, items: p.items, values: p.values, required: p.required, description: p.description, isKey: p.isKey };
                let pdesc: PropertyDescription = {
                    name: k,
                    type: p.items ? p.items + "[]" : type.name, order: p.order || 0,
                    required: p.required,
                    description: p.description,
                    typeDescription: type.description,
                    metadata,
                    custom: p.custom
                };
                this.addDescription(desc, pdesc);
            }
        }
        for (let k of Object.keys(schema.references)) {
            const r = schema.references[k];
            if (schemas.has(k)) return k;
            this.getSchemaDescription(schemas, r.item);

            let metadata = { item: r.item, cardinality: r.cardinality, required: r.required, description: r.description };
            let pdesc: PropertyDescription = {
                name: k,
                reference: r.cardinality,
                type: r.cardinality === "many" ? r.item + "[]" : r.item,
                required: r.required,
                description: r.description,
                typeDescription: "",
                metadata,
                order: r.order
            };

            if (r.item !== "any")
                desc.dependencies.add(r.item);

            this.addDescription(desc, pdesc);
        }
    }

    private getPropertyType(name: string) {
        if (!name || name === "any")
            return { name: "any" };

        while (true) {
            let type = this.domain._findType(name);
            if (!type) {
                name = name.toLowerCase();
                type = this.domain._findType(name);
            }
            if (!type || (!type.type && !type.items)) {
                if (type)
                    type.name = name;
                return type;
            }
            name = type.type || type.items;
        }
    }

    private sortSchemasDependencies() {

        this.descriptions.schemas = this.descriptions.schemas.sort((a: SchemaDescription, b: SchemaDescription) => {
            if (a.dependencies.has(b.name))
                return 1;
            return -1;
        });
        this.descriptions.schemas.forEach((s: SchemaDescription) => delete s.dependencies);
    }

    register(container: IContainer, domain: Domain, target: Function, actions: any, handlerMetadata: ServiceHandlerMetadata, kind: "action" | "query") {

        handlerMetadata = handlerMetadata || { scope: "*" };

        if (handlerMetadata.schema) {
            // test if exists
            let tmp = domain.getSchema(handlerMetadata.schema);
            handlerMetadata.schema = tmp.name;
        }

        container.inject(handlerMetadata.serviceName || target.name, target, handlerMetadata.serviceLifeTime || LifeTime.Scoped);

        for (const action in actions) {
            let actionMetadata: CommonActionMetadata = actions[action];
            actionMetadata = actionMetadata || <CommonActionMetadata>{};
            actionMetadata.action = actionMetadata.action || action;

            if (actionMetadata.schema) {
                // test if exists
                let tmp = domain.getSchema(actionMetadata.schema);
                actionMetadata.schema = tmp.name;
            }

            // Merge metadata
            let item: HandlerItem = {
                kind: kind,
                methodName: action,
                metadata: Object.assign({}, handlerMetadata, actionMetadata),
                handler: target
            };

            this.handlers.push(item);
        }
    }
}
