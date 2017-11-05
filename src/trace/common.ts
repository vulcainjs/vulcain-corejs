import { IRequestContext } from "../pipeline/common";
import { IRequestTracker } from "../metrics/trackers/index";

export enum SpanKind {
    Request,
    Command,
    Task,
    Event
}

export interface TrackerId {
    correlationId?: string;
    parentId?: string;
    spanId: string;
}

export interface ISpanTracker {
    context: IRequestContext;
    id: TrackerId;
    durationInMs: number;
    now: number;
    tracker: IRequestTracker;
    kind: SpanKind;
    trackAction(name: string, tags?: {[index:string]:string});
    addTag(name: string, value: string);

    addHttpRequestTags(uri:string, verb:string);
    addProviderCommandTags(address:string, schema: string, tenant: string );
    addServiceCommandTags(serviceName: string, serviceVersion:string);
    injectHeaders(headers: (name: string | any, value?: string) => any);
    /**
     * Log an error
     *
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     */
    logError(error: Error, msg?: () => string);

    /**
     * Log a message info
     *
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logInfo(msg: () => string);

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: () => string);

    dispose();
}

export interface ISpanRequestTracker extends ISpanTracker {
    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker;
}

export class DummySpanTracker implements ISpanRequestTracker {
    durationInMs: number = 0;
    now: number;
    tracker: IRequestTracker;
    kind: SpanKind;

    get id(): TrackerId {
        return {spanId: "0", parentId: "0"};
    }

    constructor(public context: IRequestContext) { }
    
    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker {
        return this;
    }
    trackAction(name: string, tags?: {[index:string]:string}) {
    }
    addHttpRequestTags(uri:string, verb:string){}
    addProviderCommandTags(address:string, schema: string, tenant: string ){}
    addServiceCommandTags(serviceName: string, serviceVersion:string) {}
    addTag(key: string, value: string) {
    }
    injectHeaders(headers: (name: any, value?: string)=> any) {
    }
    logError(error: Error, msg?: () => string) {
    }
    logInfo(msg: () => string) {
    }
    logVerbose(msg: () => string) {
    }
    dispose() {
    }
}