import { Domain, Schema } from './../schemas/schema';
import { ActionMetadata } from './actions';
import { LifeTime, Inject, DefaultServiceNames } from '../di/annotations';
import { Model } from './../schemas/annotations';
import { IContainer } from './../di/resolvers';
import { ServiceHandlerMetadata, CommonActionMetadata } from './common';
import { QueryActionMetadata } from './query';
import { RuntimeError } from './../errors/runtimeError';
import { System } from './../configurations/globals/system';
import { ScopesDescriptor } from './scopeDescriptors';

export interface HandlerItem {
    methodName: string;
    handler;
    metadata: CommonActionMetadata;
    kind: "action" | "query" | "event";
}

export class PropertyDescription {
    name: string;
    required: boolean;
    description: string;
    type: string;
    reference: "no" | "many" | "one";
    metadata: any;
}

export class SchemaDescription {
    name: string;
    properties: Array<PropertyDescription>;
    dependencies: Set<string>;
}

export class ActionDescription {
    schema: string;
    kind: "action" | "query" | "get";
    description: string;
    action: string;
    scope: string;
    inputSchema: string;
    outputSchema: string;
    verb: string;
    async: boolean;
}

@Model()
export class ServiceDescription {
    domain: string;
    serviceName: string;
    serviceVersion: string;
    alternateAddress: string;
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
    private monoSchema: boolean = true;

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) { }

    getDescriptions() {
        this.createHandlersTable();
        return this.descriptions;
    }

    getHandlerInfo<T extends CommonActionMetadata>(container: IContainer, schema: string, action: string, optional?: boolean) {
        this.createHandlersTable();

        let a = action && action.toLowerCase();
        let item:HandlerItem;

        if (this.monoSchema || !schema) {
            item = this.routes.get(a);
        }
        else {
            let s = schema && schema.toLowerCase();
            item = this.routes.get(s + "." + a);
        }

        if (!item) {
            if (optional)
                return null;
            else
                throw new RuntimeError(`no handler method founded for action ${action}, schema ${schema}`);
        }

        try {
            let handler = container && container.resolve(item.handler);
            return { handler: handler, metadata: <T>item.metadata, method: item.methodName, kind: item.kind };
        }
        catch (e) {
            System.log.error(null, e, `Unable to create handler action ${action}, schema ${schema}`);
            throw new Error(`Unable to create handler for action ${action}, schema ${schema}`);
        }
    }

    createHandlersTable() {
        if (!this.handlers)
            return;

        let scopes = this.container.get<ScopesDescriptor>(DefaultServiceNames.ScopesDescriptor);

        let schemas = new Map<string, SchemaDescription>();

        // Check if there is only one Schema
        let lastSchema: string;
        this.handlers.forEach(item => {
            if (!item.metadata.schema)
                return;
            if (!lastSchema)
                lastSchema = <string>item.metadata.schema;
            else if (item.metadata.schema !== lastSchema) {
                this.monoSchema = false;
            }
        });

        this.descriptions = {
            services: [],
            schemas: new Array<SchemaDescription>(),
            domain: this.domain.name,
            serviceName: System.serviceName,
            serviceVersion: System.serviceVersion,
            alternateAddress: null,
            hasAsyncTasks: false,
            scopes: scopes.getScopes().map(d => { return { name: d.name, description: d.description }; })
        };

        for (let item of this.handlers.filter(h => h.kind === "action")) {
            let schema = this.getSchemaDescription(schemas, item.metadata.schema);

            let verb = !item.metadata.schema || this.monoSchema
                ? item.metadata.action
                : schema + "." + item.metadata.action;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for action ${item.metadata.action} for handler ${item.handler.name}`);

            System.log.info(null, "Handler registered for action verb %s", verb);
            this.routes.set(verb, item);

            let metadata = <ActionMetadata>item.metadata;
            metadata.scope = this.checkScopes(scopes, metadata.scope, verb);
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

            let verb = !item.metadata.schema || this.monoSchema
                ? item.metadata.action
                : schema + "." + item.metadata.action;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for query ${item.metadata.action} for handler ${item.handler.name}`);

            System.log.info(null, "Handler registered for query verb %s", verb);
            this.routes.set(verb, item);

            if (item.metadata.action.startsWith("_service")) continue;

            let metadata = <QueryActionMetadata>item.metadata;
            metadata.inputSchema = this.getSchemaDescription(schemas, metadata.inputSchema);
            metadata.outputSchema = this.getSchemaDescription(schemas, metadata.outputSchema, schema);
            metadata.scope = this.checkScopes(scopes, metadata.scope, verb);

            let desc: ActionDescription = {
                schema: schema,
                kind: metadata.action === "get" ? "get" : "query",
                verb: verb,
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

    private checkScopes(scopes, scope: string, verb:string): string {
        if (!scope || scope === "?" || scope === "*") return scope;

        let parts = scope.split(',');
        let result = [];
        for (let sc of parts) {
            sc = System.domainName + ":" + sc.trim();
            if (!scopes.getScopes().find(s => s.name === sc))
                throw new Error(`${sc} not found in scopes descriptor for ${verb}. You must define it in (Startup)application.defineScopes.`);
            result.push(sc);
        }
        return result.join(',');
    }

    private getSchemaDescription(schemas: Map<string, SchemaDescription>, schemaName: string | Function, defaultValue?) {
        if (schemaName === "none")
            return;
        if (!schemaName)
            return defaultValue;

        let schema: Schema;
        if (typeof schemaName === "string") {
            if (ServiceDescriptors.nativeTypes.indexOf(schemaName) >= 0) return schemaName;
            let type = this.getPropertyType(schemaName);
            if (type)
                return type.name;
        }
        schema = this.domain.getSchema(schemaName);
        if (!schema)
            throw new Error("Unknow schema " + schemaName);

        let desc: SchemaDescription = schemas.get(schema.name);
        if (desc) return desc.name;

        desc = { name: schema.name, properties: [], dependencies: new Set<string>() };
        schemas.set(schema.name, desc);
        this.descriptions.schemas.push(desc);

        for (let k of Object.keys(schema.description.properties)) {
            const p = schema.description.properties[k];
            let type = this.getPropertyType(p.item || p.type);
            if (type) {
                let metadata = { type: p.type, item: p.item, values: p.values, required: p.required, description: p.description };
                let pdesc: PropertyDescription = <any>{ name: k, type: p.item ? type.name + "[]" : type.name, required: p.required, description: p.description, metadata };
                // Insert required at the beginning
                if (!pdesc.required)
                    desc.properties.push(pdesc);
                else
                    desc.properties.unshift(pdesc);
            }
        }
        for (let k of Object.keys(schema.description.references)) {
            const r = schema.description.references[k];
            if (schemas.has(k)) return k;
            this.getSchemaDescription(schemas, r.item);

            let metadata = { item: r.item, cardinality: r.cardinality, required: r.required, description: r.description };
            let pdesc: PropertyDescription = {
                name: k,
                reference: r.cardinality,
                type: r.cardinality === "many" ? r.item + "[]" : r.item,
                required: false,
                description: r.description,
                metadata
            };

            if (r.item !== "any")
                desc.dependencies.add(r.item);

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
            let type = this.domain._findType(name);
            if (!type) {
                name = name.toLowerCase();
                type = this.domain._findType(name);
            }
            if (!type || (!type.type && !type.item)) {
                if (type)
                    type.name = name;
                return type;
            }
            name = type.type || type.item;
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
