import { Domain } from './../schemas/schema';
import * as http from 'http';
import { IContainer } from '../di/resolvers';
import { CommandManager, ActionMetadata } from '../pipeline/actions';
import { QueryManager } from '../pipeline/query';
import { IManager } from '../pipeline/common';
import { RequestContext, UserContext, Pipeline } from './requestContext';
import { DefaultServiceNames } from '../di/annotations';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { ServiceDescriptors } from './../pipeline/serviceDescriptions';
import { System } from './../configurations/globals/system';
import { BadRequestError } from './../errors/badRequestError';
import { HttpResponse, BadRequestResponse } from '../pipeline/response';
import { ITenantPolicy } from '../servers/policy/defaultTenantPolicy';
import { QueryData } from '../pipeline/query';
import { ErrorMessage } from '../schemas/schema';
import { MessageBus } from '../pipeline/messageBus';
import { IHttpResponse } from '../commands/command/types';
import { CommonRequestData } from '../pipeline/common';
const guid = require('uuid');

export class VulcainHeaderNames {
    static X_VULCAIN_TENANT = "x-vulcain-tenant";
    static X_VULCAIN_CORRELATION_ID = "x-vulcain-correlation-id";
    static X_VULCAIN_CORRELATION_PATH = "x-vulcain-correlation-path";
    static X_VULCAIN_SERVICE_NAME = "x-vulcain-service-name";
    static X_VULCAIN_SERVICE_VERSION = "x-vulcain-service-version";
    static X_VULCAIN_ENV = "x-vulcain-env";
    static X_VULCAIN_CONTAINER = "x-vulcain-container";
    static X_VULCAIN_PUBLICPATH = "x-vulcain-publicpath";
}

// internal
export interface IHttpAdapterRequest {
    readonly body;
    readonly params;
    readonly query;
    readonly headers: { [name: string]: string };
    readonly hostname: string;
    readonly user: UserContext;
}

export abstract class AbstractAdapter {
    private commandManager: CommandManager;
    private queryManager;
    protected testUser: UserContext;
    private domain: Domain;
    private metrics: IMetrics;

    private calcDelayInNanoSeconds(begin: [number, number]): number {
        // ts = [seconds, nanoseconds]
        const ts = process.hrtime(begin);
        // convert seconds to miliseconds and nanoseconds to miliseconds as well
        return ts[0] * 1e9 + ts[1];
    }

    constructor(protected domainName: string, protected container: IContainer) {
        this.commandManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
        this.testUser = container.get<UserContext>(DefaultServiceNames.TestUser, true);
        this.domain = container.get<Domain>(DefaultServiceNames.Domain);
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);

        let descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        let hasAsyncTasks = descriptors.getDescriptions().hasAsyncTasks;
        this.commandManager.startMessageBus(hasAsyncTasks);
    }

    public abstract start(port: number);
    public abstract initialize();
    public abstract setStaticRoot(basePath: string);
    public abstract useMiddleware(verb: string, path: string, handler: Function);
    protected abstract initializeRequestContext(ctx: RequestContext, request: IHttpAdapterRequest);

    private startRequest(command) {
        // util.log("Request : " + JSON.stringify(command)); // TODO remove sensible data
        return process.hrtime();
    }

    protected createRequestContext(request: IHttpAdapterRequest) {
        let ctx = new RequestContext(this.container, Pipeline.HttpRequest);

        // Initialize headers & hostname
        this.initializeRequestContext(ctx, request);

        ctx.correlationId = ctx.headers[VulcainHeaderNames.X_VULCAIN_CORRELATION_ID] || guid.v4();
        ctx.correlationPath = ctx.headers[VulcainHeaderNames.X_VULCAIN_CORRELATION_PATH] || "-";

        let tenantPolicy = ctx.container.get<ITenantPolicy>(DefaultServiceNames.TenantPolicy);
        ctx.tenant = tenantPolicy.resolveTenant(ctx, request);
    }

    private endRequest(begin: [number, number], response, ctx: RequestContext, e?: Error) {
        let value = response.value;
        let hasError = false;
        let prefix: string;

        if (response instanceof HttpResponse) {
            value = response.content;
            hasError = response.statusCode && response.statusCode >= 400;
        }
        if (value) {
            hasError = hasError || value.error;
            if (value.schema) {
                prefix = value.schema.toLowerCase() + "_" + value.action.toLowerCase();
            }
            else if (value.action) {
                prefix = value.action.toLowerCase();
            }
            else {
                value = null; // custom value - don't log it
            }
        }
        else {
            hasError = true;
        }

        const duration = this.calcDelayInNanoSeconds(begin);

        // Duration
        prefix && this.metrics.timing(prefix + MetricsConstant.duration, duration);
        this.metrics.timing(MetricsConstant.allRequestsDuration, duration);

        // Failure
        if (hasError) {
            prefix && this.metrics.increment(prefix + MetricsConstant.failure);
            this.metrics.increment(MetricsConstant.allRequestsFailure);
        }

        // Always remove userContext
        if (value) {
            value.userContext = undefined;
        }

        let trace: any = {
            duration: duration,
            info: Object.assign({}, value)
        };

        // Remove result value for trace
        trace.info.value = undefined;

        if (e) {
            trace.stackTrace = e.stack;
            trace.error = e.message;
        }

        System.log.write(ctx, trace);

        // Normalize return value
        if (value) {
            value.source = undefined;
            value.inputSchema = undefined;
            value.startedAt = undefined;
            value.completedAt = undefined;
        }
    }

    private populateFromQuery(request: IHttpAdapterRequest) {
        let params = {};
        let count = 0;;
        Object.keys(request.query).forEach(name => {
            switch (name) {
                case "$action":
                case "$schema":
                case "$page":
                case "$maxByPage":
                    break;
                case "$query":
                    params = JSON.parse(request.query[name]);
                    break;
                default:
                    count++;
                    params[name] = request.query[name];
            }
        });
        return { params, count };
    }

    private populateWithActionSchema(action, request, defaultAction?) {
        let a: string;
        let s: string;

        if (request.params.schemaAction) {
            if (request.params.schemaAction.indexOf('.') >= 0) {
                let parts = request.params.schemaAction.split('.');
                s = parts[0];
                a = parts[1];
            }
            else {
                a = request.params.schemaAction;
            }
        }
        else {
            a = request.query.$action;
            s = request.query.$schema;
        }
        action.action = action.action || a || defaultAction;
        action.schema = action.schema || s;
    }

    private normalizeCommand(request: IHttpAdapterRequest) {
        let action = request.body;

        // Body contains only data -> create a new action object
        if (!action.action && !action.params && !action.schema) {
            action = { params: action };
        }
        action.domain = this.domainName;
        this.populateWithActionSchema(action, request);
        action.params = action.params || {};
        return action;
    }

    protected async executeQueryRequest(request: IHttpAdapterRequest, ctx: RequestContext) {

        if (request.user) {
            ctx.user = request.user;
        }

        let query: QueryData = <any>{ domain: this.domainName };
        this.populateWithActionSchema(query, request, "all");
        if (query.action === "get") {
            if (!request.params.id) {
                return new BadRequestResponse("Id is required");
            }

            let requestArgs = this.populateFromQuery(request);
            if (requestArgs.count === 0) {
                query.params = request.params.id;
            }
            else {
                query.params = requestArgs.params;
                query.params.id = request.params.id;
            }
        }
        else {
            query.maxByPage = (request.query.$maxByPage && parseInt(request.query.$maxByPage)) || 100;
            query.page = (request.query.$page && parseInt(request.query.$page)) || 0;
            query.params = this.populateFromQuery(request).params;
        }
        return await this.executeRequest(this.queryManager, query, ctx);
    }

    protected executeActionRequest(request: IHttpAdapterRequest, ctx: RequestContext, command?) {
        if (request.user) {
            ctx.user = request.user;
        }
        command = command || this.normalizeCommand(request);
        return this.executeRequest(this.commandManager, command, ctx);
    }

    private async executeRequest(manager: IManager, command, ctx: RequestContext): Promise<HttpResponse> {
        const begin = this.startRequest(command);

        if (!command || !command.domain) {
            return new BadRequestResponse("domain is required.");
        }
        if (command.domain.toLowerCase() !== this.domainName.toLowerCase()) {
            return new BadRequestResponse("this service doesn't belong to domain " + this.domainName);
        }
        try {
            // Check if handler exists
            let info = manager.getInfoHandler<ActionMetadata>(command);
            System.log.info(ctx, `Request context - user=${ctx.user ? ctx.user.name : "<null>"}, scopes=${ctx.user ? ctx.user.scopes : "[]"}, tenant=${ctx.tenant}`);

            // Verify authorization
            if (!ctx.hasScope(info.metadata.scope)) {
                System.log.info(ctx, `user=${ctx.user ? ctx.user.name : "<null>"}, scopes=${ctx.user ? ctx.user.scopes : "[]"} - Unauthorized for handler scope=${info.metadata.scope} `);
                return new HttpResponse({ error: { message: http.STATUS_CODES[403] } }, 403);
            }

            // Process handler
            let result: HttpResponse = await manager.runAsync(command, ctx);
            if (result && command.correlationId) {
                result.addHeader(VulcainHeaderNames.X_VULCAIN_CORRELATION_ID, command.correlationId);
            }
            // Response
            this.endRequest(begin, result, ctx);
            return result;
        }
        catch (e) {
            let result = command;
            result.error = { message: e.message || e, errors: e.errors };
            this.endRequest(begin, result, ctx, e);
            return new HttpResponse(result, e.statusCode);
        }
        finally {
            ctx && ctx.dispose();
        }
    }
}
