import { DefaultServiceNames, Injectable, LifeTime } from "../di/annotations";
import { MessageBus, EventData } from "../bus/messageBus";
import { IContainer } from "../di/resolvers";
import { Inject } from "../di/annotations";
import { IRequestContext, RequestData, Pipeline } from '../pipeline/common';
import { GraphQLTypeBuilder } from "./typeBuilder";
import { RequestContext } from "../pipeline/requestContext";
import { UnauthorizedRequestError, ApplicationError } from "../pipeline/errors/applicationRequestError";
import { Conventions } from "../utils/conventions";
import { Handler } from '../pipeline/handlers/descriptions/serviceDescriptions';

const graphql = require('graphql');
const graphQlQuerySymbol = Symbol("[[graphqlquery]]");

interface SubscriptionItem {
    subscriptions: any;
    scope: string;
}

@Injectable(LifeTime.Singleton, DefaultServiceNames.GraphQLAdapter)
export class GraphQLAdapter {
    private _schema;
    private _subscriptions = new Map<string, SubscriptionItem>();

    constructor(@Inject(DefaultServiceNames.Container) private container: IContainer) {
    }

    async processGraphQLQuery(context: IRequestContext, g: any) {
        context.requestData[graphQlQuerySymbol] = g.query || g;
        if ((g.query || g).indexOf("subscription") >= 0)
            throw new ApplicationError("Invalid subscription. Use Server Side Event on " + Conventions.instance.defaultGraphQLSubscriptionPath);
        
        let result = await graphql.graphql(this.getGraphQuerySchema(context), g.query || g, null, context, g.variables);
        return result;
    }

    enableSubscription(context: IRequestContext, handler: Handler, entity) {
        if (entity) // Subscription resolve
            return entity;
        
        // Subscription step
        let g = context.requestData[graphQlQuerySymbol];
        let item = {scope: handler.definition.scope, subscriptions: {}};
        item.subscriptions[handler.name] = g.query || g;
        this._subscriptions.set(context.requestData.correlationId, item);
    }

    getGraphQuerySchema(context: IRequestContext) {
        if (!this._schema) {
            const builder = new GraphQLTypeBuilder();
            this._schema = builder.build(context, this);
        }
        return this._schema;
    }

    getSubscriptionHandler() {
        return async (ctx: IRequestContext) => {
            let response = ctx.request.nativeResponse;
            let request = ctx.request.nativeRequest;

            let query = request.url.substr(request.url.indexOf('?') + 1);
            let parts = query && query.split('=');
            if (!parts || parts.length !== 2 || parts[0] !== "query") {
                response.statusCode = 400;
                response.end("query is required");
                return;
            }

            let g = decodeURIComponent(parts[1]);

            ctx.requestData[graphQlQuerySymbol] = g;
            let result = await graphql.graphql(this.getGraphQuerySchema(ctx), g, null, ctx);
            if (result.errors) {
                response.statusCode = 400;
                response.setHeader("ContentType", "application/json");
                response.end(JSON.stringify(result.errors));
                return;
            }

            response.setHeader('Content-Type', 'text/event-stream;charset=UTF-8');
            response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
            response.setHeader('Pragma', 'no-cache');

            let self = this;
            let id = ctx.requestData.correlationId;
            
            let subscription = MessageBus.localEvents.subscribe(
                async function onNext(evt: EventData) {
                    let eventHandlerName = evt[MessageBus.LocalEventSymbol];
                    let item = self._subscriptions.get(id); 
                    if (!item)
                        return;
                    let g = item.subscriptions[eventHandlerName];
                    if (!g)
                        return;
                    
                    // Verify authorization
                    if (item.scope && !ctx.user.hasScope(item.scope)) {
                        ctx.logError(new Error(`Unauthorized for handler ${Conventions.instance.defaultGraphQLSubscriptionPath} with scope=${item.scope}`), () => `Current user is user=${ctx.user.name}, scopes=${ctx.user.scopes}`);
                        throw new UnauthorizedRequestError();
                    }

                    let result = await graphql.graphql(self.getGraphQuerySchema(ctx), g, evt.value, ctx);

                    let payload = {
                        [eventHandlerName]: result && result.data && result.data[eventHandlerName],
                        error: evt.error
                    };

                    response.write("event: " + eventHandlerName + '\n');
                    response.write("id: " + evt.correlationId + '\n');
                    response.write("data: " + JSON.stringify(payload) + '\n\n');
                }
            );

            request.on("close", () => {
                self._subscriptions.delete(id);
                if (subscription)
                    subscription.unsubscribe();
            });
        };
    }
}