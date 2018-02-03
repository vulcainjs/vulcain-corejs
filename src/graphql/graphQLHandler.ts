import { AbstractHandler } from "../pipeline/handlers/abstractHandlers";
import { ActionHandler } from "../pipeline/handlers/annotations.handlers";
import { DefaultServiceNames } from "../di/annotations";
import { ModelPropertyInfo } from "../schemas/schemaInfo";
import { ServiceDescriptors } from "../pipeline/handlers/serviceDescriptions";
import { HandlerProcessor } from "../pipeline/handlerProcessor";
import { Domain } from '../schemas/domain';
import { Schema } from '../schemas/schema';
import { IRequestContext, RequestData } from '../pipeline/common';
import { HttpResponse } from "../pipeline/response";
import { Action } from "../pipeline/handlers/annotations";

const graphql = require('graphql');

@ActionHandler({ async: false, scope: "?" })
export class GraphQLActionHandler extends AbstractHandler {

    private types = new Map<string, any>();

    private createType(domain: Domain, schema: Schema) {
        let t = this.types.get(schema.name);
        if (t)
            return t;
        let fields = {};
        for (let p in schema.info.properties) {
            let prop = schema.info.properties[p];
            // getbasetype
            switch (prop.type) {
                case "uid":
                case "string":
                    fields[prop.name] = { type: graphql["GraphQLString"] };
                    break;
                case "number":
                    fields[prop.name] = { type: graphql["GraphQLFloat"] };
                    break;
                case "boolean":
                    fields[prop.name] = { type: graphql["GraphQLBool"] };
                    break;
                default:
                    let sch = domain.getSchema(prop.type, true);
                    if (sch) {
                        let t = this.createType(domain, sch);
                        if (prop.cardinality === "many")
                            t = new graphql.GraphQLList(t);
                        fields[prop.name] = {
                            type: t,
                            resolve: this.resolve
                        };
                    }
            }
            if (prop.required) {
                   fields[prop.name] = graphql.GraphQLNonNull(fields[prop.name]);
            }
        }

        let type = new graphql.GraphQLObjectType({
            name: schema.name,
            fields
        });
        this.types.set(schema.name, type);
        return type;
    }

    async resolve(entity, args, ctx: IRequestContext, info) {
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
        let handler = processor.getHandlerInfo(ctx.container, schema.name, isList ? "all": "get");
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
            data.maxByPage = args._pagesize;
            delete args._pagesize;
        }
        let res = await processor.invokeHandler(ctx, handler, data);
        return res.content.value;
    }
    
    @Action({ description: "Custom action", outputSchema: "string" }) 
    async graphql(g: any) {

        this.types.clear();
        let fields = {};
        let domain = this.context.container.get<Domain>(DefaultServiceNames.Domain);
        for (let schema of domain.schemas) {
            if (schema.info.custom && schema.info.custom.system)
                continue;
            let type = this.createType(domain, schema);

            // Define the Query type
            fields[schema.name.toLowerCase()] =
                {
                    type: new graphql.GraphQLList(type),
                    // `args` describes the arguments that the `user` query accepts
                    args: {
                        id: { type: graphql.GraphQLString },
                        _pagesize: { type: graphql.GraphQLInt },
                        _page: { type: graphql.GraphQLInt }
                    },
                    resolve: this.resolve
                };
        }

        let queryType = new graphql.GraphQLObjectType({
            name: 'Query',
            fields
        });

        let response = await graphql.graphql(new graphql.GraphQLSchema({ query: queryType }), g, null, this.context);
        return new HttpResponse(response);
    }
}
