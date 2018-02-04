import { IContainer } from "../di/resolvers";
import { ServiceDescriptors } from "../pipeline/handlers/descriptions/serviceDescriptions";
import { DefaultServiceNames } from "../di/annotations";
import { HandlerProcessor } from "../pipeline/handlerProcessor";
import { Domain } from '../schemas/domain';
import { Schema } from '../schemas/schema';
import { IRequestContext, RequestData } from '../pipeline/common';
import { OperationDescription } from "../pipeline/handlers/descriptions/operationDescription";
const graphql = require('graphql');

export class GraphQLTypeBuilder {
    private types = new Map<string, any>();
    private descriptors: ServiceDescriptors;
    private domain: Domain;

    constructor(private container:IContainer) {
        this.descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        this.domain = this.container.get<Domain>(DefaultServiceNames.Domain);
    }
    
    private *getHandlers(kind: "action"|"query") {
        for (let handler of this.descriptors.getDescriptions(false).services) {
            if (!handler.async && handler.kind === kind)
                yield handler;    
        }    
    }

    build() {
        return new graphql.GraphQLSchema({
            query: this.createQueryOperations(),
            mutation: this.createMutationOperations(),
            types: Array.from(this.types.values())
        });
    }

    private createQueryOperations() {
        let fields = {};
        for (let queryHandler of this.getHandlers("query")) {
            if (queryHandler.action === "get")
                continue;

            let { operationName, outputType, args } = this.createHandlerType(queryHandler);
            if (!outputType)
                throw new Error(`GRAPHQL : Query handler ${queryHandler.verb} must have an output schema`);
            
            // Define the Query type
            fields[operationName] =
                {
                type: queryHandler.outputCardinality === "one" ? new graphql.GraphQLList(outputType) : outputType,
                    args,
                    resolve: this.resolve
                };
        }
        return new graphql.GraphQLObjectType({
            name: 'Query',
            fields
        });
    }

    private createMutationOperations() {
        let fields = {};
        for (let actionHandler of this.getHandlers("action")) {
   
            let { operationName, outputType, args } = this.createHandlerType(actionHandler);
            let type = outputType && actionHandler.outputCardinality === "one" ? new graphql.GraphQLList(outputType) : outputType;

            // Define the Query type
            fields[operationName] =
                {
                    type,
                    args,
                    resolve: this.resolve
                };
        }

        return new graphql.GraphQLObjectType({
            name: 'Mutation',
            fields
        });
    }

    private createHandlerType(queryHandler: OperationDescription) {
        let outputSchema = queryHandler.outputSchema && this.domain.getSchema(queryHandler.outputSchema, true);
        let args: any;
        let operationName = queryHandler.verb.replace(/\./g, "_");

        let outputType = this.createType(outputSchema);

        if (queryHandler.inputSchema) {
                let inputSchema = this.domain.getSchema(queryHandler.inputSchema, true);
               // if (inputSchema)
               //     args = this.createType(inputSchema, true);
        }    
        else if (queryHandler.action === "all") {
            if(outputSchema)
                operationName = outputSchema.name;
            args = {
                _pagesize: { type: graphql.GraphQLInt },
                _page: { type: graphql.GraphQLInt }
            };

            if (!outputSchema || !outputSchema.getIdProperty()) {
                args[outputSchema.getIdProperty()] = { type: graphql["GraphQLString"] }; // TODO get type from prop
            }
        }

        // Ensure outputType is not null
        if (!outputType) {
            if (queryHandler.outputSchema)
                outputType = this.createScalarType(queryHandler.outputSchema);
            else
                outputType = graphql.GraphQLString; // Force a type (void is not authorized with graphQL)
        }
        
        return { operationName, outputType, args };
    }

    private createScalarType(propType: string) {
        if (!propType)
            return null;    
        switch (this.domain.getScalarTypeOf(propType)) {
            case "uid":
            case "string":
                return graphql["GraphQLString"];
            case "number":
                return graphql["GraphQLFloat"];
            case "boolean":
                return graphql["GraphQLBoolean"];
        }
        return null;
    }

    private createType(schema: Schema, createInputType = false) {
        if (!schema)
            return null;
        
        let t = this.types.get(schema.name);
        if (t)
            return t;

        let fields = {};
        for (let p in schema.info.properties) {
            let prop = schema.info.properties[p];

            let type = this.createScalarType(prop.type);

            if (!type) {
                let sch = this.domain.getSchema(prop.type, true);
                if (sch) {
                    let t = this.createType(sch);
                    if (prop.cardinality === "many")
                        t = new graphql.GraphQLList(t);
                    fields[prop.name] = {
                        type: t,
                        resolve: this.resolve
                    };
                }
            }
            else {
                fields[prop.name] = { type };
            }

            if (prop.description)
                fields[prop.name].description = prop.description;
            
            if (prop.required) {
                let t = fields[prop.name].type;
                fields[prop.name].type = graphql.GraphQLNonNull(t);
                fields[prop.name].type.name = t.name + "!";
            }
        }

        t = {
            name: schema.name,
            fields: () => fields
        };

        if (schema.info.description)
            t.description = schema.info.description;

        let type;
        if (createInputType) {
            t.name = t.name + "_Input";
            type = new graphql.GraphQLInputType(t);
        }
        else {
            type = new graphql.GraphQLObjectType(t);
        }
        this.types.set(schema.name, type);

        return type;
    }

    private async resolve(entity, args, ctx: IRequestContext, info) {
        if (info.returnType.$$resolver) {
            return info.returnType.$$resolver(entity, ctx);
        }
        // check root schema
        // else check remote root schema (=> au démarrage faire une requete à toutes les depandances sur _servicedescription pour connaitre les root schema)
        // else return entity[fieldName]
        let schema = info.returnType;
        let isList = false;
        while (schema.ofType) {
            schema = schema.ofType;
            isList = true;
        }

        let processor = ctx.container.get<HandlerProcessor>(DefaultServiceNames.HandlerProcessor);
        let handler = processor.getHandlerInfo(ctx.container, schema.name, isList ? "all" : "get");
        if (!handler) {
            // args doit être null sinon faut faire une recherche ????
            let fn = info.fieldName;
            info.returnType.$$resolver = (e) => e && e[fn];
            return info.returnType.$$resolver(entity);
        }

        let data: RequestData = { ...ctx.requestData, params: args };
        if (args._page) {
            data.page = args._page;
            delete args._page;
        }
        if (args._pagesize) {
            data.pageSize = args._pagesize;
            delete args._pagesize;
        }
        let res = await processor.invokeHandler(ctx, handler, data);
        return res.content.value;
    }

}