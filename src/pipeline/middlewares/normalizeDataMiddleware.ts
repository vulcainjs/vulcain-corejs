import { RequestContext } from "../requestContext";
import { VulcainMiddleware } from "../vulcainPipeline";
import { BadRequestError } from "../errors/badRequestError";
import { Conventions } from "../../utils/conventions";
import { ApplicationError } from "../errors/applicationRequestError";
import { HttpResponse } from "../response";
import { Service } from "../../globals/system";

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
    //  $action, _schema (force value)
    //  $pageSize, $page
    async invoke(ctx: RequestContext) {
        try {
            this.populateData(ctx);
        }
        catch (e) {
            ctx.logError(e, () => "Bad request format for " + ctx.request.url.pathname);
            ctx.response = HttpResponse.createFromError(new BadRequestError("Invalid request format"));
            return;
        }

         try {
            await super.invoke(ctx);
            if (!ctx.response) {
                ctx.response = new HttpResponse({});
            }
        }
        catch (e) {
            if (!(e instanceof ApplicationError)) {
                e = new ApplicationError(e.message, 500);
            }
            ctx.logError(e, () => "Request has error");
            ctx.response = HttpResponse.createFromError(e);
        }

        // Inject request context in response
        if( Service.isTestEnvironment)
            ctx.response.addHeader('Access-Control-Allow-Origin', '*'); // CORS

        if (Object.getOwnPropertyDescriptor(ctx.response.content, "value") || Object.getOwnPropertyDescriptor(ctx.response.content, "error")) {
            ctx.response.content.meta = ctx.response.content.meta || {};
            ctx.response.content.meta.correlationId = ctx.requestData.correlationId;
        }
    }

    private populateData(ctx: RequestContext) {
        let action: string;
        let schema: string;

        const url = ctx.request.url;
        const body = ctx.request.body;

        ctx.requestData.body = body;

        // Try to get schema and action from path
        let schemaAction = url.pathname.substr(Conventions.instance.defaultUrlprefix.length + 1);
        if (schemaAction) {
            if (schemaAction[schemaAction.length - 1] === '/')
                schemaAction = schemaAction.substr(0, schemaAction.length - 1);
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
        
        ctx.requestData.params = ctx.requestData.params || {};
        
        // Or can be forced in the url query
        if (url.query["$action"])
            action = url.query["$action"];
        if (url.query["_schema"])
            schema = url.query["_schema"];

        ctx.requestData.action = action || (!body && "all") || null;
        ctx.requestData.schema = schema;

        // if (ctx.request.verb === "GET" && ctx.requestData.action !== "get") {
            ctx.requestData.page = 0;
            ctx.requestData.pageSize = 20;
        //}
        // Normalize option values
        Object.keys(url.query).forEach(name => {
            try {
                switch (name.toLowerCase()) {
                    case "$page":
                        ctx.requestData.page = (url.query["$page"] && parseInt(url.query["$page"])) || ctx.requestData.page;
                        break;
                    case "$pagesize":
                        ctx.requestData.pageSize = (url.query[name] && parseInt(url.query[name])) || ctx.requestData.pageSize;
                        break;
                    case "$query":
                        ctx.requestData.params = url.query["$query"] && JSON.parse(url.query["$query"]);
                        break;
                }
            }
            catch (ex) {/*ignore*/ }
        });

        ctx.requestData.vulcainVerb = ctx.requestData.schema ?  `${ctx.requestData.schema}.${ctx.requestData.action}` : ctx.requestData.action;
        ctx.requestTracker.trackAction(ctx.requestData.vulcainVerb);
    }
}