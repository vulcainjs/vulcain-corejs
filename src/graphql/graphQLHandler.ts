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
import { ApplicationError } from "../pipeline/errors/applicationRequestError";
import { ISpanRequestTracker } from "../instrumentations/common";
const graphql = require('graphql');

export class GraphQLActionHandler extends AbstractHandler {
    private static _schema;

    get graphQuerySchema() {
        if (!GraphQLActionHandler._schema) {
            const builder = new GraphQLTypeBuilder(this.context);
            GraphQLActionHandler._schema = builder.build();
        }
        return GraphQLActionHandler._schema;

    }

    @Action({ description: "Custom action", name: "_graphql" })
    async graphql(g: any) {
        
        (<ISpanRequestTracker>this.context.requestTracker).trackAction("graphql");

        let response = await graphql.graphql(this.graphQuerySchema, g.query || g, null, this.context, g.variables);
        if (this.metadata.metadata.responseType === "graphql")
            return new HttpResponse(response);

        if (response.errors && response.errors.length > 0) {
            throw new ApplicationError(response.errors[0].message);
        }
        return response.data;
    }
}
