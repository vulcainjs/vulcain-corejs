import { RequestContext } from '../servers/requestContext';
import { ActionMetadata } from '../pipeline/actions';
import { HttpResponse } from '../pipeline/response';

export interface IMockManager {
    enabled: boolean;
    applyMockHttpAsync(url: string, verb: string);
    applyMockServiceAsync(serviceName: string, serviceVersion: string, verb: string, data);
    tryGetMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, params);
    saveMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, params, result: HttpResponse);
}

export class DummyMockManager implements IMockManager {
    get enabled() { return false;}
    tryGetMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any) {
    }
    saveMockValueAsync(ctx: RequestContext, metadata: ActionMetadata, verb: string, command: any, result: HttpResponse) {
    }
    applyMockHttpAsync(url: string, verb: string) {
        return undefined;
    }
    applyMockServiceAsync(serviceName: string, serviceVersion: string, verb: string, data: any) {
        return undefined;
    }
}