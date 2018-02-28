import { AbstractHandler } from "../pipeline/handlers/abstractHandlers";
import { DefaultServiceNames } from "../di/annotations";
import { HttpResponse } from "../pipeline/response";
import { ActionHandler, Action } from "../pipeline/handlers/action/annotations";
import { ApplicationError } from "../pipeline/errors/applicationRequestError";
import { ISpanRequestTracker } from "../instrumentations/common";
import { IContainer } from "../di/resolvers";
import { Inject } from "../di/annotations";
import { EventNotificationMode } from "../bus/messageBus";
import { GraphQLAdapter } from "./graphQLAdapter";



export class GraphQLActionHandler extends AbstractHandler {
    private static _schema;

    constructor(
        @Inject(DefaultServiceNames.Container) container: IContainer,
        @Inject(DefaultServiceNames.GraphQLAdapter) private _adapter: GraphQLAdapter) {
        super(container);
    }

    @Action({ description: "Custom action", name: "_graphql", eventMode:EventNotificationMode.never })
    async graphql(g: any) {
        
        (<ISpanRequestTracker>this.context.requestTracker).trackAction("graphql");

        let response = await this._adapter.processGraphQLQuery(this.context, g);
        if (this.metadata.metadata.responseType === "graphql")
            return new HttpResponse(response);

        if (response.errors && response.errors.length > 0) {
            throw new ApplicationError(response.errors[0].message);
        }
        return response.data;
    }
}
