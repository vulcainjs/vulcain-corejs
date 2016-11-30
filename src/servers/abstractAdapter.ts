import { Domain } from './../schemas/schema';
import * as http from 'http';
import { IContainer } from '../di/resolvers';
import { CommandManager, ActionMetadata } from '../pipeline/actions';
import { QueryManager } from '../pipeline/query';
import { IManager, HttpResponse } from '../pipeline/common';
import { RequestContext, UserContext } from './requestContext';
import { DefaultServiceNames } from '../di/annotations';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { ServiceDescriptors } from './../pipeline/serviceDescriptions';
import { System } from './../configurations/globals/system';
import { BadRequestError } from './../errors/badRequestError';

export abstract class AbstractAdapter {
    private commandManager: CommandManager;
    private queryManager;
    private testUser: UserContext;
    private domain: Domain;
    private metrics: IMetrics;

    private calcDelayInMs(begin: [number, number]): number {
        // ts = [seconds, nanoseconds]
        const ts = process.hrtime(begin);
        // convert seconds to miliseconds and nanoseconds to miliseconds as well
        return (ts[0] * 1000) + (ts[1] / 1000000);
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
    public abstract setStaticRoot(basePath: string);
    public abstract useMiddleware(verb: string, path: string, handler: Function);

    protected startRequest(command) {
        // util.log("Request : " + JSON.stringify(command)); // TODO remove sensible data
        return process.hrtime();
    }

    protected endRequest(begin: [number, number], response, ctx: RequestContext, e?: Error) {
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

        const ms = this.calcDelayInMs(begin);
        // Duration
        prefix && this.metrics.timing(prefix + MetricsConstant.duration, ms);
        this.metrics.timing(MetricsConstant.allRequestsDuration, ms);

        // Failure
        if (hasError) {
            prefix && this.metrics.increment(prefix + MetricsConstant.failure);
            this.metrics.increment(MetricsConstant.allRequestsFailure);
        }

        let trace: any = {
            duration: ms,
            info: Object.assign({}, value)
        };

        delete trace.info.value;

        if (e) {
            trace.stackTrace = e.stack;
            trace.message = e.message;
        }
        System.log.write(ctx, trace);
    }

    protected executeQueryRequest(query, ctx) {
        return this.executeRequestInternal(this.queryManager, query, ctx);
    }

    protected executeCommandRequest(command, ctx) {
        return this.executeRequestInternal(this.commandManager, command, ctx);
    }

    private executeRequestInternal(manager: IManager, command, ctx: RequestContext): Promise<{ code: number, value: any, headers: Map<string, string> }> {
        let self = this;
        return new Promise((resolve, reject) => {
            let headers = new Map<string, string>();
            if (!command || !command.domain) {
                resolve({ value: "domain is required.", code: 400, headers: headers });
                return;
            }
            if (command.domain.toLowerCase() !== self.domainName.toLowerCase()) {
                resolve({ value: "this service doesn't belong to domain " + self.domainName, code: 400, headers: headers });
                return;
            }

            try {
                // Check if handler exists
                let info = manager.getInfoHandler<ActionMetadata>(command);
                // Force test user only if there is no authorization
                if (!ctx.user && this.testUser && !ctx.headers["authorization"]) {
                    ctx.user = this.testUser;
                    ctx.tenant = ctx.tenant || ctx.user.tenant;
                    System.log.info(ctx, `Request context - force test user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.tenant}`);
                }
                else {
                    System.log.info(ctx, `Request context - user=${ctx.user ? ctx.user.name : "<null>"}, scopes=${ctx.user ? ctx.user.scopes : "[]"}, tenant=${ctx.tenant}`);
                }

                // Verify authorization
                if (!ctx.hasScope(info.metadata.scope)) {
                    System.log.info(ctx, `user=${ctx.user ? ctx.user.name : "<null>"}, scopes=${ctx.user ? ctx.user.scopes : "[]"} - Unauthorized for handler scope=${info.metadata.scope} `);
                    resolve({ code: 403, status: "Unauthorized", value: { error: { message: http.STATUS_CODES[403] } } });
                    return;
                }
            }
            catch (e) {
                reject(e);
                return;
            }

            // Execute handler
            manager.runAsync(command, ctx)
                .then(result => {
                    if (result instanceof HttpResponse) {
                        resolve(result);
                    }
                    else {
                        if (command.correlationId) {
                            headers.set("X-VULCAIN-CORRELATION-ID", command.correlationId);
                        }
                        if (result) {
                            delete result.userContext;
                        }
                        // TODO https://github.com/phretaddin/schemapack
                        resolve({ value: result, headers: headers });
                    }
                    ctx.dispose();
                })
                .catch(result => {
                    // Normalize error
                    if (result instanceof BadRequestError) {
                        resolve({ code: 400, value: { status: "Error", error: { message: result.message } }, headers: headers });
                        return;
                    }
                    else if (result instanceof Error) {
                        result = { status: "Error", error: { message: result.message } };
                    }
                    resolve({ code: 500, value: result, headers: headers });
                    ctx.dispose();
                });
        });
    }
}
