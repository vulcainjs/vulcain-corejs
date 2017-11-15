import { RequestContext } from "../pipeline/requestContext";
import { ActionMetadata } from "../pipeline/handlers/actions";
import { HttpResponse } from "../pipeline/response";

export interface IStubManager {
    enabled: boolean;
    initialize?(sessions: any, saveHandler: Function);
    applyHttpStub(url: string, verb: string);
    applyServiceStub(serviceName: string, serviceVersion: string, verb: string, data);
    tryGetMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any): Promise<HttpResponse>;
    saveStub(ctx: RequestContext, metadata: ActionMetadata, verb: string, params: any, result: HttpResponse): Promise<void>;
}

export class DummyStubManager implements IStubManager {
    get enabled() { return false;}
    tryGetMockValue(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any): Promise<HttpResponse> {
        return Promise.resolve(null);;
    }
    saveStub(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any, result: HttpResponse): Promise<void> {
        return Promise.resolve();
    }
    applyHttpStub(url: string, verb: string) {
        return undefined;
    }
    applyServiceStub(serviceName: string, serviceVersion: string, verb: string, data: any) {
        return undefined;
    }
}