import { RequestContext, VulcainHeaderNames } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { BadRequestError } from "../errors/badRequestError";
import { Conventions } from "../../utils/conventions";
import { DefaultServiceNames } from "../../di/annotations";
import { VulcainLogger } from "../../log/vulcainLogger";
import { ApplicationRequestError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { System } from "../../globals/system";

/**
 * Populate requestData property with action or query context
 */
export class NormalizeDataMiddleware extends VulcainMiddleware {

    // get
    //  /api/customer.get[/id](?params)
    //  /api/customer(?params)  // action=all
    // post
    //  /api/customer.create(?params)
    // params:
    //  $action, $schema (force value)
    //  $maxByPage, $page
    async invoke(ctx: RequestContext) {
        try {
            this.populateData(ctx);
        }
        catch (e) {
            ctx.logError(e, () => "Bad request format for " + ctx.request.url.pathname);
            ctx.response = HttpResponse.createFromError(new BadRequestError("Invalid request format"));
            return;
        }

        let logger = ctx.container.get<VulcainLogger>(DefaultServiceNames.Logger);
        let action = ctx.requestData.vulcainVerb;
        logger.logAction(ctx, "RR", action, "params: " + JSON.stringify(ctx.requestData.params));

        try {
            await super.invoke(ctx);
            if (!ctx.response) {
                ctx.response = new HttpResponse({});
            }

            //let trace = Object.assign({}, ctx.response && ctx.response.content);
            // Remove result value for trace
            //trace.value = undefined;
            logger.logAction(ctx, "ER", action, `End request status: ${(ctx.response && ctx.response.statusCode) || 200}`);// value: ${trace && JSON.stringify(trace)}`);
        }
        catch (e) {
            if (!(e instanceof ApplicationRequestError)) {
                e = new ApplicationRequestError(e.message, 500);
            }
            ctx.metrics.trackError(e);
            logger.logAction(ctx, "ER", action, `End request status: ${(e.statusCode)} value: ${e.message}`);
            ctx.response = HttpResponse.createFromError(e);
        }

        // Inject request context in response
        if( System.isTestEnvironnment)
            ctx.response.addHeader('Access-Control-Allow-Origin', '*'); // CORS

        if (typeof (ctx.response.content) === "object") {
            ctx.response.content.meta = ctx.response.content.meta || {};
            ctx.response.content.meta.correlationId = ctx.correlationId;
        }
    }

    private populateData(ctx: RequestContext) {
        let action: string;
        let schema: string;
        let id: string = null;

        const url = ctx.request.url;
        const body = ctx.request.body;

        ctx.requestData = <any>{  };
        ctx.requestData.body = (typeof body === "object") ? body : JSON.parse(body);

        // Try to get schema and action from path
        let schemaAction = url.pathname.substr(Conventions.instance.defaultUrlprefix.length + 1);
        if (schemaAction) {
            if (schemaAction[schemaAction.length - 1] === '/')
                schemaAction = schemaAction.substr(0, schemaAction.length - 1);

            // Path can contain an id (/schema.action/id)
            let pos = schemaAction && schemaAction.indexOf('/') || -1;
            if (pos >= 0) {
                id = schemaAction.substr(pos + 1);
                schemaAction = schemaAction.substr(0, pos);
            }
        }

        // Split schema and action (schema is optional)
        if (schemaAction) {
            if (schemaAction.indexOf('.') >= 0) {
                let parts = schemaAction.split('.');
                schema = parts[0];
                action = parts[1];
            }
            else {
                action = schemaAction;
            }
        }
        // Schema and action can be in the body
        if (body) {
            // Body contains only data -> create a new action object
            if (!ctx.requestData.body.action && !ctx.requestData.body.params && !ctx.requestData.body.schema) {
                ctx.requestData.params = ctx.requestData.body;
            }
            else {
                action = ctx.requestData.body.action || action;
                schema = ctx.requestData.body.schema || schema;
            }
        }
        else {
            url.query && Object.keys(url.query).forEach(k => {
                if (k[0] !== "$") {
                    ctx.requestData.params = ctx.requestData.params || {};
                    ctx.requestData.params[k] = url.query[k];
                }
            });
        }

        // Or can be forced in the url query
        if (url.query.$action)
            action = url.query.$action;
        if (url.query.$schema)
            schema = url.query.$schema;

        ctx.requestData.action = action || !body && "all";
        ctx.requestData.schema = schema;

        if (ctx.request.verb === "GET" && ctx.requestData.action !== "get") {
            ctx.requestData.page = 0;
            ctx.requestData.maxByPage = 100;
        }
        // Normalize option values
        Object.keys(url.query).forEach(name => {
            try {
                switch (name) {
                    case "$page":
                        ctx.requestData.page = (url.query.$page && parseInt(url.query.$page)) || ctx.requestData.page;
                        break;
                    case "$maxByPage":
                        ctx.requestData.maxByPage = (url.query.$maxByPage && parseInt(url.query.$maxByPage)) || ctx.requestData.maxByPage;
                        break;
                    case "$query":
                        ctx.requestData.params = url.query.$query && JSON.parse(url.query.$query);
                        break;
                }
            }
            catch (ex) {/*ignore*/ }
        });

        // If there is an id and no params, params is the id
        if (!ctx.requestData.params) {
            ctx.requestData.params = id || {};
        }
        else if(id) {
            ctx.requestData.params.id = id;
        }
        ctx.requestData.vulcainVerb = `${ctx.requestData.schema}.${ctx.requestData.action}`;
    }
}