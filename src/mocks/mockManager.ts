import { CommonRequestData } from '../pipeline/common';
import { IMockManager } from "./imockManager";
import { RequestContext } from '../servers/requestContext';
import { ActionMetadata } from '../pipeline/actions';
import { HttpResponse } from '../pipeline/response';
import { Conventions } from '../utils/conventions';
import { System } from '../configurations/globals/system';
import { VulcainHeaderNames } from '../servers/abstractAdapter';
import { IDynamicProperty } from '../configurations/dynamicProperty';

export class MockManager implements IMockManager {
    private mocks;
    private sessions;
    useMockProperty: IDynamicProperty<string>;
    registerMockProperty: IDynamicProperty<string>;
    private saveSessionsAsync: (sessions) => Promise<any>;

    get enabled() {
        return System.isTestEnvironnment && (!this.mocks || !this.mocks.disabled);
    }

    constructor() {
        this.useMockProperty = System.createServiceConfigurationProperty<string>("vulcainUseMockSession");
        this.registerMockProperty = System.createServiceConfigurationProperty<string>("vulcainRegisterMockSession");
    }

    initialize(mocks, saveSessionsAsync?: (sessions) => Promise<any>) {
        this.saveSessionsAsync = saveSessionsAsync;
        this.mocks = mocks;
        this.sessions = (mocks && mocks.sessions) || {};
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private deepCompare(a, b) {
        if (!b) {
            return true;
        }
        if (!a) {
            return false;
        }

        // Compare ignorecase
        if (typeof b !== "object") {
            const regex = new RegExp('^' + b.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + '$', "i");
            return regex.test(a);
        }

        for (let p of Object.keys(b)) {
            let val = b[p];
            if (typeof val === "object") {
                if (!this.deepCompare(a[p], val)) {
                    return false;
                }
                continue;
            }
            if (Array.isArray(val)) {
                let val2 = a[p];
                if (val.length !== val2.length) {
                    return false;
                }
                for (let i; i < val.length; i++) {
                    if (!this.deepCompare(val2[i], val[i])) {
                        return false;
                    }
                }
                continue;
            }
            if (!this.deepCompare(a[p], val)) {
                return false;
            }
        }
        return true;
    }

    public async applyMockHttpAsync(url: string, verb: string) {
        if (!this.mocks || !this.mocks.http) {
            return undefined;
        }
        let mock = this.mocks.http[url && url.toLowerCase()];
        mock = (mock && verb && mock[verb.toLowerCase()]) || mock;
        const res = (mock && mock.output) || mock || undefined;
        if (res !== undefined && mock.output && mock.delay) {
            await this.sleep(mock.delay);
        }
        return res;
    }

    public applyMockServiceAsync(serviceName: string, serviceVersion: string, verb: string, data) {
        if (!this.mocks || !serviceName || !this.mocks.services) {
            return undefined;
        }

        // Find on service name
        let mockService = this.mocks.services[serviceName.toLowerCase()];
        // And optionaly on service version
        mockService = (mockService && mockService[serviceVersion]) || mockService;
        if (!mockService) {
            return;
        }

        // Verb is optional
        let mock = verb && mockService[verb.toLowerCase()];
        return this.getMockResultAsync(mock, data);
    }

    private async getMockResultAsync(mock, data) {
        if (!mock) {
            return;
        }
        if (!Array.isArray(mock)) {
            return mock;
        }

        // Iterate over data input filter
        for (let item of mock) {
            let input = item.input; // Input filter
            if (!input) {
                continue;
            }
            if (this.deepCompare(data, input)) {
                if (item.lag) {
                    await this.sleep(item.lag);
                }
                return item.output; // result
            }
        }
        return;
    }

    protected async readMockSessions(session: string, verb: string): Promise<any> {
        let serviceSessions = this.sessions && this.sessions[session];
        return serviceSessions && serviceSessions[verb];
    }

    protected writeMockSessions(sessionName: string, verb: string, data): Promise<any> {
        let serviceSessions = this.sessions[sessionName] = this.sessions[sessionName] || {};
        let session: any[] = serviceSessions[verb] = serviceSessions[verb] || [];

        let ix = 0;
        for (let item of session) {
            let input = item.input;
            if (input) {
                if (this.deepCompare(data, input)) {
                    session.splice(ix, 1); // remove old item
                    break;
                }
            }
            ix++;
        }

        session.push(data);
        return this.saveSessionsAsync(this.sessions);
    }

    private splitAndTestSession(val: string): string {
        if (!val) {
            return null;
        }
        const pos = val.indexOf(':');
        if (pos <= 0) {
            return val;
        }

        const session = val.substr(0, pos);
        const filter = val.substr(pos + 1);
        if (!filter || filter === '*') {
            return session;
        }

        const regex = new RegExp(filter, 'i');
        if (regex.test(System.serviceName)) {
            return session;
        }
        return null;
    }

    async tryGetMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any): Promise<HttpResponse> {
        const setting = this.useMockProperty.value || ctx.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK];
        const session = this.splitAndTestSession(setting);
        if (!session) {
            return undefined;
        }

        let result = await this.getMockResultAsync(await this.readMockSessions(session, verb), params);
        if (result && result.content) {
            result.content.correlationId = ctx.correlationId;
        }
        return HttpResponse.createFromResponse(result);
    }

    saveMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any, result: HttpResponse) {
        const setting = this.registerMockProperty.value || ctx.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK];
        const session = this.splitAndTestSession(setting);
        if (!session) {
            return undefined;
        }
        const data = {
            input: params,
            output: result
        };
        return this.writeMockSessions(session, verb, data);
    }
}