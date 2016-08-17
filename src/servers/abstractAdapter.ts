// Entry point
import * as express from 'express';
import * as os from 'os';
import * as http from 'http';
import {IContainer} from '../di/resolvers';
import {CommandManager, ActionMetadata} from '../pipeline/actions';
import {CommonRequestData} from '../pipeline/common';
import {QueryManager} from '../pipeline/query';
import {IManager} from '../pipeline/common';
import {BadRequestError, Logger} from 'vulcain-configurationsjs';
import {RequestContext, UserContext} from './requestContext';
import {DefaultServiceNames} from '../di/annotations';

export abstract class AbstractAdapter {
    private _logger: Logger;
    private commandManager;
    private queryManager;
    private testUser: UserContext;

    private calcDelayInMs(begin: number[]): number {
        // ts = [seconds, nanoseconds]
        const ts = process.hrtime(begin);
        // convert seconds to miliseconds and nanoseconds to miliseconds as well
        return (ts[0] * 1000) + (ts[1] / 1000000);
    }

    constructor(protected domainName:string, protected container: IContainer) {
        this.commandManager = new CommandManager(container);
        this.queryManager = new QueryManager(container);
        this.testUser = container.get<UserContext>(DefaultServiceNames.TestUser, true);
    }

    public abstract start(port:number);
    public abstract setStaticRoot(basePath: string);
    public abstract useMiddleware(verb: string, path: string, handler: Function);

    protected startRequest() {
        return process.hrtime();
    }

    protected endRequest(begin: number[], command:CommonRequestData, code:number) {
        const ms = this.calcDelayInMs(begin);
    }

    protected executeQueryRequest(query, ctx){
        return this.executeRequestInternal(this.queryManager, query, ctx);
    }

    protected executeCommandRequest(command, ctx){
        return this.executeRequestInternal(this.commandManager, command, ctx);
    }

    private executeRequestInternal(manager: IManager, command, ctx:RequestContext): Promise<{ code: number, value:any, headers:Map<string,string>}> {
        let self = this;
        return new Promise((resolve) => {
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
                let metadata = <ActionMetadata>manager.getMetadata(command);
                ctx.logger = self._logger;
                ctx.user = ctx.user || this.testUser;

                let code;
                if (metadata.scope && (code = ctx.hasScope(metadata.scope))) {
                    resolve({ code: 200, status: "Unauthorized", value: { error: { message: http.STATUS_CODES[code] } } });
                    return;
                }
            }
            catch (e) {
                resolve({ value: { status: "Error", error: { message: e.message || e } }, code: 500, headers: headers });
                return;
            }

            manager.runAsync(command, ctx)
                .then(result => {
                    if(command.correlationId)
                        headers.set("X-VULCAIN-CORRELATION-ID", command.correlationId);
                    if (result)
                        delete result.userContext;
                    // TODO https://github.com/phretaddin/schemapack
                    resolve({ value: result, headers: headers });
                })
                .catch(result => {
                    if (result instanceof BadRequestError) {
                        resolve({ code: 400, value: {status: "Error", error: {message:result.message}}, headers: headers });
                        return
                    }
                    else if (result instanceof Error) {
                        result = { status: "Error", error: { message: result.message } };
                    }
                    resolve( { code: 500, value: result, headers:headers });
                });
        });
    }
}
