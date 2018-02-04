import { AbstractHandler } from "../pipeline/handlers/abstractHandlers";
import { DefaultServiceNames } from "../di/annotations";
import { ModelPropertyDefinition } from "../schemas/schemaInfo";
import { ServiceDescriptors } from "../pipeline/handlers/descriptions/serviceDescriptions";
import { HandlerProcessor } from "../pipeline/handlerProcessor";
import { Domain } from '../schemas/domain';
import { Schema } from '../schemas/schema';
import { IRequestContext, RequestData } from '../pipeline/common';
import { HttpResponse } from "../pipeline/response";
import { ActionHandler, Action } from "../pipeline/handlers/action/annotations";
import { GraphQLTypeBuilder } from "./typeBuilder";
const graphql = require('graphql');

@ActionHandler({ async: false, scope: "?" }, { system: true })
export class GraphQLActionHandler extends AbstractHandler {
    private static _schema;

    get graphQuerySchema() {
        if (!GraphQLActionHandler._schema) {
            const builder = new GraphQLTypeBuilder(this.container);
            GraphQLActionHandler._schema = builder.build();
        }
        return GraphQLActionHandler._schema;

    }

    @Action({ description: "Custom action", outputSchema: "string" })
    async graphql(g: any) {
        let response = await graphql.graphql( this.graphQuerySchema, g, null, this.context);
        return new HttpResponse(response);
    }
}
