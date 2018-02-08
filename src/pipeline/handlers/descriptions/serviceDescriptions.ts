import { Domain} from '../../../schemas/domain';
import { LifeTime, Inject, DefaultServiceNames } from '../../../di/annotations';
import { IContainer } from '../../../di/resolvers';
import { Service } from '../../../globals/system';
import { ScopesDescriptor } from "../../../defaults/scopeDescriptors";
import { Schema } from '../../../schemas/schema';
import { ISchemaTypeDefinition } from '../../../schemas/schemaType';
import { ServiceDescription } from './serviceDescription';
import { SchemaDescription } from './schemaDescription';
import { OperationDescription } from './operationDescription';
import { PropertyDescription } from './propertyDescription';
import { ActionDefinition } from '../action/definitions';
import { OperationDefinition, HandlerDefinition } from '../definitions';
import { QueryOperationDefinition } from '../query/definitions';

export interface Handler {
    methodName: string;
    handler: any;
    definition: OperationDefinition;
    kind: "action" | "query" | "event";
    verb?: string;
}

export class ServiceDescriptors {
    static nativeTypes = ["string", "boolean", "number", "any", "object"];
    private descriptions: ServiceDescription;
    private publicDescriptions: ServiceDescription;
    private handlers = new Array<Handler>();
    private routes = new Map<string, Handler>();
    private defaultSchema: string;

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) {
    }

    getDescriptions(includeSystemService=true) {
        this.createHandlersTable();
        if (includeSystemService)
            return this.descriptions;
        
        return this.publicDescriptions;
    }

    getHandlerInfo(container: IContainer|undefined, schema: string, action: string): Handler {
        this.createHandlersTable();

        let verb = action && action.toLowerCase();
        let item: Handler|undefined;

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
            return null;
        }

        try {
            let handler = container && container.resolve(item.handler);
            return { handler: handler, definition: item.definition, methodName: item.methodName, verb: verb, kind: item.kind };
        }
        catch (e) {
            Service.log.error(null, e, ()=>`Unable to create handler action ${action}, schema ${schema}`);
            throw new Error(`Unable to create handler for action ${action}, schema ${schema}`);
        }
    }

    private createHandlersTable() {
        if (!this.handlers)
            return;

        let scopes = this.container.get<ScopesDescriptor>(DefaultServiceNames.ScopesDescriptor);

        let schemas = new Map<string, SchemaDescription>();

        // Check if there is only one Schema
        let lastSchema: string|undefined;
        let monoSchema = true;
        this.handlers.forEach(item => {
            if (!item.definition.schema)
                return;
            if (!lastSchema)
                lastSchema = <string>item.definition.schema;
            else if (item.definition.schema !== lastSchema) {
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
            let schema = item.definition.schema && this.getSchemaDescription(schemas, item.definition.schema);

            let verb = !schema
                ? item.definition.name
                : schema + "." + item.definition.name;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for action ${item.definition.name} for handler ${item.handler.name}`);

            Service.log.info(null, ()=> `Handler registered for action verb ${verb}`);
            this.routes.set(verb, item);
            item.verb = verb;

            let def = <ActionDefinition>item.definition;
            def.scope = this.checkScopes(scopes, def, verb);
            def.inputSchema = this.getSchemaDescription(schemas, def.inputSchema, schema);
            def.outputSchema = !def.async && this.getSchemaDescription(schemas, def.outputSchema, schema);

            let desc: OperationDescription = {
                schema: schema,
                kind: "action",
                async: def.async,
                verb: verb,
                outputCardinality: def.outputCardinality || "one",
                description: def.description,
                name: def.name,
                scope: def.scope,
                inputSchema: <string>def.inputSchema,
                outputSchema: <string>def.outputSchema,
                metadata: def.metadata
            };

            if (def.async)
                this.descriptions.hasAsyncTasks = true;

            this.descriptions.services.push(desc);
        }

        // Query
        for (let item of this.handlers.filter(h => h.kind === "query")) {

            let schema = item.definition.schema && this.getSchemaDescription(schemas, item.definition.schema);

            let verb = !item.definition.schema
                ? item.definition.name
                : schema + "." + item.definition.name;

            verb = verb.toLowerCase();
            if (this.routes.has(verb))
                throw new Error(`*** Duplicate handler for query ${item.definition.name} for handler ${item.handler.name}`);

            Service.log.info(null, ()=> `Handler registered for query verb ${verb}`);
            this.routes.set(verb, item);
            item.verb = verb;

            if (item.definition.name.startsWith("_service")) continue;

            let def = <QueryOperationDefinition>item.definition;
            def.inputSchema = this.getSchemaDescription(schemas, def.inputSchema);
            def.outputSchema = this.getSchemaDescription(schemas, def.outputSchema, schema);
            def.scope = this.checkScopes(scopes, def, verb);

            let desc: OperationDescription = {
                schema: schema,
                kind: def.name === "get" ? "get" : "query",
                verb: verb,
                outputCardinality: def.outputCardinality || (def.name === "get" ? "one" : "many"),
                description: def.description,
                name: def.name,
                scope: def.scope,
                async: false,
                inputSchema: <string>def.inputSchema,
                outputSchema: <string>def.outputSchema,
                metadata: def.metadata
            };

            if (desc.name === "get" && !desc.inputSchema)
                desc.inputSchema = "string";
            if (desc.name !== "get")
                desc.outputSchema = desc.outputSchema; // ???
            
            this.descriptions.services.push(desc);
        }

        this.sortSchemasDependencies();

        this.publicDescriptions = { ...this.descriptions };
        this.publicDescriptions.services = this.publicDescriptions.services.filter(s => !s.metadata.system);
        this.publicDescriptions.schemas = this.publicDescriptions.schemas.filter(s => !s.metadata.system);

        this.handlers = null;
    }

    private checkScopes(scopes: ScopesDescriptor, metadata: OperationDefinition, verb: string): string {
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

        if (typeof schemaName === "function")
            schemaName = schemaName.name;

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
            idProperty: schema.info.idProperty,
            dependencies: new Set<string>(),
            metadata: schema.info.metadata
        };
        schemas.set(schema.name, desc);
        this.descriptions.schemas.push(desc);
        let sd = schema;
        while (sd) {
            this.updateDescription(schemas, sd, desc);
            sd = sd.extends;
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

    private updateDescription(schemas: Map<string, SchemaDescription>, schema: Schema, desc: SchemaDescription) {
        for (let k of Object.keys(schema.info.properties)) {
            const p = schema.info.properties[k];
            if (p.private)
                continue;
            let type = this.getPropertyType(p.itemsType || p.type);
            if (type) {
                let def = { type: p.type, itemsType: p.itemsType, values: p.values, required: p.required, description: p.description, isKey: p.isKey, ...p.metadata };
                let pdesc: PropertyDescription = {
                    name: k,
                    type: p.itemsType ? p.itemsType + "[]" : type.name, order: p.order || 0,
                    required: p.required,
                    description: p.description,
                    typeDescription: type.description,
                    definition:def
                };
                this.addDescription(desc, pdesc);
            }
            else if( p.cardinality) {
                if (schemas.has(k)) return k;
             //   this.getSchemaDescription(schemas, p.type);

                let def = { item: p.type, cardinality: p.cardinality, required: p.required, description: p.description, ...p.metadata  };
                let pdesc: PropertyDescription = {
                    name: k,
                    reference: p.cardinality,
                    type: p.cardinality === "many" ? p.type + "[]" : p.type,
                    required: p.required,
                    description: p.description,
                    typeDescription: "",
                    definition: def,
                    order: p.order
                };

                if (p.type !== "any")
                    desc.dependencies.add(p.type);

                this.addDescription(desc, pdesc);
            }
        }
    }

    private getPropertyType(name: string): ISchemaTypeDefinition {
        if (!name || name === "any")
            return { name: "any" };

        while (true) {
            let type = this.domain.getType(name);
            if (!type) {
                name = name.toLowerCase();
                type = this.domain.getType(name);
            }
            if (!type || (!type.type)) {
                if (type)
                    type.name = name;
                return type;
            }
            name = type.type;
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

    /**
     * Register an handler
     * @param container
     * @param domain
     * @param target
     * @param actions
     * @param handlerDefinition
     * @param kind
     */
    register(container: IContainer, domain: Domain, target: Function, actions: any, handlerDefinition: HandlerDefinition, kind: "action" | "query") {

        handlerDefinition = handlerDefinition || { scope: "*" };

        if (handlerDefinition.schema) {
            // test if exists
            let tmp = domain.getSchema(handlerDefinition.schema);
            handlerDefinition.schema = tmp.name;
        }

        container.inject(handlerDefinition.serviceName || target.name, target, handlerDefinition.serviceLifeTime || LifeTime.Scoped);

        for (const action in actions) {
            let actionMetadata: OperationDefinition = actions[action];
            actionMetadata = actionMetadata || <OperationDefinition>{};
            actionMetadata.name = actionMetadata.name || action;
            actionMetadata.metadata = { ...actionMetadata.metadata, ...handlerDefinition.metadata };

            if (actionMetadata.schema) {
                // test if exists
                let tmp = domain.getSchema(actionMetadata.schema);
                actionMetadata.schema = tmp.name;
            }

            // Merge metadata
            let item: Handler = {
                kind: kind,
                methodName: action,
                definition: Object.assign({}, handlerDefinition, actionMetadata),
                handler: target
            };

            this.handlers.push(item);
        }
    }
}
