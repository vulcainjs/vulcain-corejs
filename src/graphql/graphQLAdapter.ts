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
        let result = await graphql.graphql(this.getGraphQuerySchema(context), g.query || g, null, context, g.variables);
        return result;
    }

    enableSubscription(context: IRequestContext, handler: Handler, id: string, entity) {
        if (entity) // Subscription resolve
            return entity;
        
        // Subscription step
        let g = context.requestData[graphQlQuerySymbol];
        let item = this._subscriptions.get(id);
        if (!item)
            item = {scope: handler.definition.scope, subscriptions: {}};
        item.subscriptions[handler.name] = g.query || g;
        this._subscriptions.set(id, item);
    }

    getGraphQuerySchema(context?: IRequestContext) {
        if (!this._schema) {
            const builder = new GraphQLTypeBuilder();
            this._schema = builder.build(context, this);
        }
        return this._schema;
    }

    getSubscriptionHandler() {
        return (ctx: IRequestContext) => {
            let response = ctx.request.nativeResponse;
            let request = ctx.request.nativeRequest;

            response.setHeader('Content-Type', 'text/event-stream;charset=UTF-8');
            response.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
            response.setHeader('Pragma', 'no-cache');

            let query = request.url.substr(request.url.indexOf('?') + 1);
            let parts = query && query.split('=');
            if (!parts || parts.length !== 2 || parts[0] !== "channel") {
                response.statusCode = 400;
                response.end("channel is required");
                return;
            }

            let self = this;
            let id = parts[1];
            let context = new RequestContext(this.container, Pipeline.HttpRequest);

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

                    let result = await graphql.graphql(self.getGraphQuerySchema(context), g, evt.value, context);

                    let payload = {
                        [eventHandlerName]: result && result.data && result.data[eventHandlerName],
                        error: evt.error
                    };

                    response.write("event: " + eventHandlerName + '\n');
                    response.write("data: " + JSON.stringify(payload) + '\n\n');
                }
            );

            request.on("close", () => {
                self._subscriptions.delete(id);
                if (subscription)
                    subscription.unsubscribe();
                context.dispose();
            });
        };
    }
}