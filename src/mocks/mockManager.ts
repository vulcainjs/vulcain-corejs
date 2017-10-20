import { IMockManager } from "./imockManager";
import { Conventions } from '../utils/conventions';
import { System } from '../globals/system';
import { IDynamicProperty } from '../configurations/abstractions';
import { RequestContext, VulcainHeaderNames } from "../pipeline/requestContext";
import { ActionMetadata } from "../pipeline/handlers/actions";
import { HttpResponse } from "../pipeline/response";
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';

export class MockManager implements IMockManager {
    private mocks: any;
    private sessions: any;
    useMockProperty: IDynamicProperty<string>;
    registerMockProperty: IDynamicProperty<string>;
    private saveSessions: (sessions:any) => Promise<any>;

    get enabled() {
        return System.isTestEnvironnment && (!this.mocks || !this.mocks.disabled);
    }

    constructor() {
        this.useMockProperty = DynamicConfiguration.getChainedConfigurationProperty<string>("UseMockSession");
        this.registerMockProperty = DynamicConfiguration.getChainedConfigurationProperty<string>("SaveMockSession");
    }

    initialize(mocks:any, saveSessions?: (sessions:any) => Promise<any>) {
        this.saveSessions = saveSessions;
        this.mocks = mocks;
        this.sessions = (mocks && mocks.sessions) || {};
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private deepCompare(a:any, b:any) {
        if (!b) {
            return true;
        }
        if (!a) {
            return false;
        }

        if (a === b)
            return true;

        if (typeof a !== typeof b)
            return false;

        // Compare ignorecase
        if (typeof b === "string") {
            const regex = new RegExp('^' + b.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") + '$', "i");
            return regex.test(a);
        }

        if (typeof a !== "object") {
            return false
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
                for (let i=0; i < val.length; i++) {
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

    public async applyMockHttp(url: string, verb: string) {
        if (!this.mocks || !this.mocks.http) {
            return undefined;
        }
        let mock = this.mocks.http[url && url.toLowerCase()];
        mock = (mock && verb && mock[verb.toLowerCase()]) || mock;
        const res = (mock && mock.output) || mock || undefined;
        if (res !== undefined && mock.output && mock.latency) {
            await this.sleep(mock.latency);
        }
        return res;
    }

    public applyMockService(serviceName: string, serviceVersion: string, verb: string, data:any) {
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
        return this.getMockResult(mock, data);
    }

    private CreateResponse(content:any) {
        let statusCode: number|undefined;
        let contentType: string|undefined;
        if (typeof (content) === "object") {
            statusCode = content.statusCode;
            contentType = content.contentType;
            content = content.content;
        }
        let res = new HttpResponse(content, statusCode); // result
        res.contentType = contentType;
        return res;
    }

    private async getMockResult(mock:any|null, data:any): Promise<HttpResponse|undefined> {
        if (!mock) {
            return;
        }
        if (!Array.isArray(mock)) {
            return this.CreateResponse(mock)
        }

        // Iterate over data input filter
        for (let item of mock) {
            let input = item.input; // Input filter
            if (this.deepCompare(data, input)) {
                if (item.latency) {
                    await this.sleep(item.latency);
                }

                return this.CreateResponse(item.output)
            }
        }
    }

    protected async readMockSessions(session: string, verb: string): Promise<any> {
        let serviceSessions = this.sessions && this.sessions[session];
        return serviceSessions && serviceSessions[verb];
    }

    protected writeMockSessions(sessionName: string, verb: string, data:any): Promise<any> {
        let serviceSessions = this.sessions[sessionName] = this.sessions[sessionName] || {};
        let session: any[] = serviceSessions[verb] = serviceSessions[verb] || [];

        let ix = 0;
        for (let item of session) {
            let input = item.input;
            if (input) {
                if (this.deepCompare(data.input, input)) {
                    session.splice(ix, 1); // remove old item
                    break;
                }
            }
            ix++;
        }

        session.push(data);
        return this.saveSessions(this.sessions);
    }

    /**
     * Session syntax :
     *  <session>[:<filter]
     *  session : session name to use (save and get data)
     *  filter : * | any part of a full service name (regexp)
     *   ex for ServiceA, version 1.0 => fullName = ServiceA-1.0
     *   filter : ServiceA, Service, ServiceA-1, Service.-1\.0
     */
    private splitAndTestSession(val: string): string|null {
        if (!val) {
            return null;
        }

        const pos = val.indexOf('=');
        if (pos <= 0) {
            return val;
        }

        const session = val.substr(0, pos);
        const filter = val.substr(pos + 1);
        if (!filter || filter === '*') {
            return session;
        }

        const regex = new RegExp(filter, 'i');
        if (regex.test(System.fullServiceName)) {
            return session;
        }
        return null;
    }

    async tryGetMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any) {
        const setting = this.useMockProperty.value || <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_USE_MOCK];
        const session = this.splitAndTestSession(setting);
        if (!session) {
            return undefined;
        }

        let result = await this.getMockResult(await this.readMockSessions(session, verb), params);
        return result;
    }

    saveMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any, result: HttpResponse) {
        const setting = this.registerMockProperty.value || <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_REGISTER_MOCK];
        const session = this.splitAndTestSession(setting);
        if (!session) {
            return undefined;
        }
        const data = {
            input: params,
            output: { content: result.content, contentType: result.contentType, statusCode: result.statusCode }
        };
        return this.writeMockSessions(session, verb, data);
    }
}