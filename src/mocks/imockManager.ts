import { RequestContext } from "../pipeline/requestContext";
import { ActionMetadata } from "../pipeline/handlers/actions";
import { HttpResponse } from "../pipeline/response";

export interface IMockManager {
    enabled: boolean;
    initialize?(sessions: any, saveHandler: Function);
    applyMockHttp(url: string, verb: string);
    applyMockService(serviceName: string, serviceVersion: string, verb: string, data);
    tryGetMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any): Promise<HttpResponse>;
    saveMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any, result: HttpResponse): Promise<void>;
}

export class DummyMockManager implements IMockManager {
    get enabled() { return false;}
    tryGetMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any): Promise<HttpResponse> {
        return Promise.resolve(null);;
    }
    saveMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any, result: HttpResponse): Promise<void> {
        return Promise.resolve();
    }
    applyMockHttp(url: string, verb: string) {
        return undefined;
    }
    applyMockService(serviceName: string, serviceVersion: string, verb: string, data: any) {
        return undefined;
    }
}