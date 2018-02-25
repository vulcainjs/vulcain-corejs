import { IContainer } from "../di/resolvers";
import { ServiceDescriptors } from "../pipeline/handlers/descriptions/serviceDescriptions";
import { DefaultServiceNames, Injectable, LifeTime } from "../di/annotations";
import { HandlerProcessor } from "../pipeline/handlerProcessor";
import { Domain } from '../schemas/domain';
import { Schema } from '../schemas/schema';
import { IRequestContext, RequestData } from '../pipeline/common';
import { OperationDescription } from "../pipeline/handlers/descriptions/operationDescription";
import { Service, MemoryProvider, TYPES } from "..";
import { MongoQueryParser } from "../providers/memory/mongoQueryParser";
import { ModelPropertyDefinition } from "../schemas/schemaInfo";
import { CommandManager } from "../pipeline/handlers/action/actionManager";
import { GraphQLAdapter } from "./graphQLAdapter";
const graphql = require('graphql');

export interface GraphQLDefinition {
    type?: string;
    expose?: boolean;
    resolve?: (source?: any,
        args?: { [argName: string]: any },
        context?: any,
        info?: any) => any;
    resolveMutation?: (source?: any,
        args?: { [argName: string]: any },
        context?: any,
        info?: any) => any;
}

export interface IGraphQLSchemaBuilder {
    build(context: IRequestContext, adapter: GraphQLAdapter): any;
}

export class GraphQLTypeBuilder implements IGraphQLSchemaBuilder {
    private propertyTypes = new Map<string, any>();
    private types = new Map<string, any>();
    private interfaces = new Map<string, any>();
    private descriptors: ServiceDescriptors;
    private domain: Domain;
    private context: IRequestContext;

    private *getHandlers(kind: "action" | "query") {
        for (let handler of this.descriptors.getDescriptions(false).services) {
            if (!handler.async && handler.kind === kind)
                yield handler;
        }
    }

    build(context: IRequestContext, adapter: GraphQLAdapter) {
        this.context = context;
        this.descriptors = context.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        this.domain = context.container.get<Domain>(DefaultServiceNames.Domain);

        return new graphql.GraphQLSchema({
            query: this.createQueryOperations(),
            mutation: this.createMutationOperations(),
            subscription: this.createSubscriptionOperations(adapter),
            types: Array.from(this.types.values())
        });
    }

    private createQueryOperations() {
        let fields = {};
        let hasFields = false;

        for (let queryHandler of this.getHandlers("query")) {
            const def: GraphQLDefinition = queryHandler.metadata.graphql || {};
            if (def.expose === false)
                continue;

            if (queryHandler.name === "get")
                continue;

            let { operationName, outputType, args } = this.createHandlerType(queryHandler);
            if (!outputType)
                continue;

            // Define the Query type
            fields[operationName] =
                {
                    type: queryHandler.outputCardinality === "many" ? new graphql.GraphQLList(outputType) : outputType,
                    args,
                    resolve: def.resolve || this.resolveQuery
                };
            hasFields = true;
            this.context.logInfo(() => `GRAPHQL: Enabling query handler ${operationName}`);
        }

        return hasFields ?
            new graphql.GraphQLObjectType({
                name: 'Query',
                fields
            })
            : null;
    }

    private createMutationOperations() {
        let fields = {};
        let hasFields = false;

        for (let actionHandler of this.getHandlers("action")) {
            const def: GraphQLDefinition = actionHandler.metadata.graphql || {};
            if (def.expose === false)
                continue;

            let { operationName, outputType, args } = this.createHandlerType(actionHandler);
            if (!outputType)
                continue;
            let type = actionHandler.outputCardinality === "many" ? new graphql.GraphQLList(outputType) : outputType;

            // Define the Query type
            fields[operationName] =
                {
                    type,
                    args,
                    resolve: def.resolveMutation || this.resolveMutation
                };
            hasFields = true;
            this.context.logInfo(() => `GRAPHQL: Enabling mutation handler ${operationName}`);
        }

        return hasFields
            ? new graphql.GraphQLObjectType({
                name: 'Mutation',
                fields
            })
            : null;
    }

    private createSubscriptionOperations(adapter: GraphQLAdapter) {
        let fields = {};
        let hasFields = false;

        for (let handler of CommandManager.eventHandlersFactory.allHandlers()) {
            const def: GraphQLDefinition = (handler.definition.metadata && handler.definition.metadata.graphql) || {};
            if (def.expose === false)
                continue;

            let schemaName = handler.definition.schema || (<any>handler.definition).subscribeToSchema;
            let outputSchema = schemaName && this.domain.getSchema(schemaName, true);
            let args = { ["channel"]: { type: graphql.GraphQLNonNull(this.typeToGraphQLType("string")) } };
            let operationName = handler.name.replace(/\./g, "_");

            let outputType = this.createType(outputSchema);

            // Ignore handler if outputSchema is not a model
            if (!outputType) {
                this.context.logInfo(() => `GRAPHQL: Skipping subscription handler ${handler.methodName} with no schema or with a scalar output schema.`);
                continue;
            }

            // Define the Query type
            fields[operationName] =
                {
                    type: outputType,
                    args,
                    resolve: (entity, args, ctx) => adapter.enableSubscription(ctx, handler.name, args.channel, entity)
                };
            hasFields = true;
            
            this.context.logInfo(() => `GRAPHQL: Enabling subscription handler ${operationName}`);
        }
        return hasFields
            ? new graphql.GraphQLObjectType({
                name: 'Subscription',
                fields
            })
            : null;
    }

    private createHandlerType(handler: OperationDescription) {
        let outputSchema = handler.outputSchema && this.domain.getSchema(handler.outputSchema, true);
        let args: any;
        let operationName = handler.verb.replace(/\./g, "_");

        let outputType = this.createType(outputSchema);

        // Ignore handler if outputSchema is not a model
        if (!outputType) {
            this.context.logInfo(() => `GRAPHQL: Skipping handler ${handler.verb} with no outputSchema or with a scalar output schema.`);
            return {};
        }

        if (handler.inputSchema) {
            let inputSchema = this.domain.getSchema(handler.inputSchema, true);
            if (inputSchema)
                args = { ["input"]: { type: this.createType(inputSchema, true) } };
        }
        else if (handler.name === "all") {
            if (outputSchema)
                operationName = outputSchema.name;
            args = {
                _pagesize: { type: graphql.GraphQLInt },
                _page: { type: graphql.GraphQLInt }
            };

            if (outputSchema) {
                const idPropertyName = outputSchema.getIdProperty();
                if (idPropertyName) {
                    const idProperty = outputSchema.info.properties[idPropertyName];
                    args[outputSchema.getIdProperty()] = {
                        type: this.createScalarType(idProperty.type, idProperty, outputSchema.name)
                    };
                }
            }
        }

        return { operationName, outputType, args };
    }

    private typeToGraphQLType(type: string) {
        switch (type) {
            case "string":
                return graphql["GraphQLString"];
            case "number":
                return graphql["GraphQLFloat"];
            case "boolean":
                return graphql["GraphQLBoolean"];
        }
        return null;
    }

    private createScalarType(propType: string, property: ModelPropertyDefinition, prefix: string) {
        if (!propType)
            return null;

        if (propType === "id" || propType === "uid")
            return graphql["GraphQLID"];

        if (propType === TYPES.enum) {
            let typeName = prefix + "_" + property.name + "_enum";
            let tmp = this.propertyTypes.get(typeName);
            if (tmp)
                return tmp;

            let t = this.domain.getType(propType);
            if (t) {
                const values = {};
                Object.keys(property.values).forEach(v => values[property.values[v]] = { value: property.values[v] });
                tmp = new graphql.GraphQLEnumType({
                    name: typeName,
                    values,
                    description: t.description
                });
                this.propertyTypes.set(typeName, tmp);
                return tmp;
            }
        }

        if (propType === TYPES.arrayOf) {
            let typeName = prefix + "_" + property.name + "arrayOf";
            let tmp = this.propertyTypes.get(typeName);
            if (tmp)
                return tmp;
            tmp = new graphql.GraphQLScalarType({
                name: typeName,
                serialize: value => {
                    return value;
                },
                parseValue: value => {
                    return value;
                },
                parseLiteral: ast => {
                    if (ast.kind !== graphql.Kind.STRING && ast.kind !== graphql.Kind.NUMBER) {
                        throw new graphql.GraphQLError('Query error: Can only parse id got a: ' + ast.kind, [ast]);
                    }
                    return ast.value;
                }
            });
            this.propertyTypes.set(typeName, tmp);
            return tmp;
        }

        return this.typeToGraphQLType(this.domain.getScalarTypeOf(propType));
    }

    createInterfaceType(schema: Schema, createInputType = false) {
        if (!schema)
            return null;

        let name = schema.name;
        if (createInputType)
            name = name + "_Input";

        let t = this.interfaces.get(name);
        if (t)
            return t;

        let iType = new graphql.GraphQLInterfaceType({
            name: name + "_Interface",
            fields: () => this.createInterfaceFields(schema, createInputType),
            resolveType: (val) => {
                if (!val._schema)
                    throw new Error("Unable to resolve an union type. You must set the _schema property.");
                return val._schema;
            },
            description: schema.info.description
        });
        this.interfaces.set(name, iType);
        return iType;
    }

    private createType(schema: Schema, createInputType = false, interfaceType?: any) {
        if (!schema)
            return null;

        let name = schema.name;
        if (createInputType)
            name = name + "_Input";

        let t = this.types.get(name);
        if (t)
            return t;

        let subModels = schema.subModels();
        if (!createInputType) {
            for (let subModel of subModels) {
                if (!interfaceType) {
                    interfaceType = this.createInterfaceType(schema, createInputType);
                }
                this.createType(subModel, createInputType, interfaceType);
            }
        }

        let fields = this.createFields(schema, createInputType);
        let type = createInputType
            ? new graphql.GraphQLInputObjectType({
                name,
                interfaces: interfaceType && [interfaceType],
                fields: () => fields,
                description: schema.info.description
            })
            : new graphql.GraphQLObjectType({
                name,
                interfaces: interfaceType && [interfaceType],
                fields: () => fields,
                description: schema.info.description
            });

        this.types.set(name, type);
        return interfaceType || type;
    }

    private createFields(schema: Schema, createInputType: boolean, fields?: any) {
        fields = fields || { "_schema": { type: graphql.GraphQLString } };

        for (let prop of schema.allProperties()) {
            const def: GraphQLDefinition = prop.metadata.graphql || {};
            if (def.expose === false)
                continue;

            const propType = createInputType ? prop.type : (prop.reference || prop.type);
            let type = this.createScalarType(propType, prop, schema.name);
            if (!type) {
                let sch = this.domain.getSchema(propType, true);
                if (sch) {
                    let t = this.createType(sch, createInputType);
                    if (prop.cardinality === "many")
                        t = new graphql.GraphQLList(t);
                    fields[prop.name] = {
                        type: t,
                        description: prop.description
                    };

                    if (!createInputType)
                        fields[prop.name].resolve = def.resolve || this.resolveQuery;
                }
            }
            else {
                if (prop.cardinality === "many")
                    type = new graphql.GraphQLList(type);
                fields[prop.name] = { type, description: prop.description };
            }

            if (prop.required && fields[prop.name]) {
                let t = fields[prop.name].type;
                fields[prop.name].type = graphql.GraphQLNonNull(t);
            }
        }

        if (createInputType) {
            for (let subModel of schema.subModels()) {
                this.createFields(subModel, true, fields);
            }
        }

        return fields;
    }

    private createInterfaceFields(schema: Schema, createInputType: boolean) {
        let fields = { "_schema": { type: graphql.GraphQLString } };
        for (let prop of schema.allProperties()) {
            const def: GraphQLDefinition = prop.metadata.graphql || {};
            if (def.expose === false)
                continue;

            const propType = createInputType ? prop.type : (prop.reference || prop.type);
            let type = this.createScalarType(propType, prop, schema.name + "_input");
            if (!type) {
                let sch = this.domain.getSchema(propType, true);
                if (sch) {
                    let t = this.createType(sch, createInputType);
                    if (prop.cardinality === "many")
                        t = new graphql.GraphQLList(t);
                    fields[prop.name] = {
                        type: t,
                        description: prop.description
                    };
                }
            }
            else {
                fields[prop.name] = { type, description: prop.description };
            }

            if (prop.required && fields[prop.name]) {
                let t = fields[prop.name].type;
                fields[prop.name].type = graphql.GraphQLNonNull(t);
            }
        }
        return fields;
    }

    private async resolveMutation(entity, args, ctx: IRequestContext, info: any) {
        let processor = ctx.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
        let fieldName: string = info.fieldName;
        let pos = fieldName.lastIndexOf('_');
        if (pos < 0) {
            ctx.requestData.schema = null;
            ctx.requestData.action = fieldName;
        }
        else {
            ctx.requestData.schema = fieldName.substr(0, pos);
            ctx.requestData.action = fieldName.substr(pos + 1);
        }
        ctx.requestData.params = args.input;
        ctx.requestData.vulcainVerb = fieldName;

        let handler = processor.getHandlerInfo(ctx.container, ctx.requestData.schema, ctx.requestData.action);
        ctx.requestData.schema = handler.definition.schema;

        let res = await processor.invokeHandler(ctx, handler);
        return res.content.value;
    }

    private async resolveQuery(entity, args, ctx: IRequestContext, info) {
        let fieldName: string = info.fieldName;
        // First root request, populate schema and action from fieldname
        if (!ctx.requestData.schema) {
            let pos = fieldName.lastIndexOf('_');
            if (pos < 0) {
                ctx.requestData.schema = fieldName;
                ctx.requestData.action = "all";
            }
            else {
                ctx.requestData.schema = fieldName.substr(0, pos);
                ctx.requestData.action = fieldName.substr(pos + 1);
            }
            ctx.requestData.vulcainVerb = fieldName;
        }

        let data: RequestData = { ...ctx.requestData };
        if (args._page) {
            data.page = args._page;
            delete args._page;
        }
        if (args._pagesize) {
            data.pageSize = args._pagesize;
            delete args._pagesize;
        }
        data.params = args;

        const resolverSymbol = Symbol.for("vulcain_resolver_" + fieldName);
        if (info.returnType[resolverSymbol]) {
            return info.returnType[resolverSymbol](entity && entity[fieldName], data);
        }

        let embedded = false;
        if (entity) { // Is it the root ?
            let domain = ctx.container.get<Domain>(DefaultServiceNames.Domain);
            let schema = domain.getSchema(ctx.requestData.schema);
            let prop = schema.findProperty(fieldName);

            let itemSchema = domain.getSchema(prop.reference, true);
            if (!itemSchema) {
                embedded = true;
            }
            else {
                let fk = prop.referenceProperty || itemSchema.getIdProperty();
                let value = entity[fieldName];
                if (Array.isArray(value)) {
                    data.params = {
                        [fk]: {
                            $in: value
                        }
                    };
                }
                else {
                    data.params = { [fk]: value };
                }
                data.schema = itemSchema.name;
                data.action = "all";
                data.vulcainVerb = itemSchema.name + ".all";
            }
        }

        let processor = ctx.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
        let handler = !embedded && processor.getHandlerInfo(ctx.container, data.schema, data.action);
        if (!handler) {
            // Embedded object        
            // Cache resolver
            info.returnType[resolverSymbol] = GraphQLTypeBuilder.resolveEmbeddedObject;
            return info.returnType[resolverSymbol](entity && entity[fieldName], ctx);
        }

        let res = await processor.invokeHandler(ctx, handler, data);
        return res.content.value;
    }

    private static resolveEmbeddedObject(obj, data: RequestData) {
        if (!obj)
            return null;

        if (Array.isArray(obj)) {
            return MemoryProvider.Query(obj, data.params, data.page, data.pageSize);
        } else {
            const queryParser = new MongoQueryParser(data.params);
            return queryParser.execute(obj) ? obj : null;
        }
    }
}