import { IRequestContext } from "../pipeline/common";
import { ITrackerAdapter } from "../instrumentations/trackers/index";
import { Service } from "../globals/system";

export enum SpanKind {
    Request,
    Command,
    Task,
    Event,
    Custom
}

export interface TrackerId {
    correlationId?: string;
    parentId?: string;
    spanId?: string;
}

export interface ITracker {
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
    id: TrackerId;
}

export interface ISpanTracker extends ITracker {
    context: IRequestContext;
    durationInMs: number;
    now: number;
    tracker: ITrackerAdapter;
    kind: SpanKind;
    trackAction(name: string, tags?: {[index:string]:string});
    addTag(name: string, value: string);

    addHttpRequestTags(uri:string, verb:string);
    addProviderCommandTags(address:string, schema: string, tenant: string );
    addServiceCommandTags(serviceName: string, serviceVersion: string);
    addCustomCommandTags(commandType: string, tags: { [key: string]: string });
    injectHeaders(headers: (name: string | any, value?: string) => any);
}

export interface ISpanRequestTracker extends ISpanTracker {
    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker;
    createCustomTracker(context: IRequestContext, name: string, tags?: { [index: string]: string }): ITracker;
}

export class DummySpanTracker implements ISpanRequestTracker {
    durationInMs: number = 0;
    now: number;
    tracker: ITrackerAdapter;
    kind: SpanKind;

    get id(): TrackerId {
        return { spanId: "0", parentId: "0" };
    }

    constructor(public context: IRequestContext) { }

    createCustomTracker(context: IRequestContext, name: string, tags?: { [index: string]: string }): ITracker {
        return null;
    }

    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker {
        return this;
    }
    trackAction(name: string, tags?: { [index: string]: string }) {
    }
    addHttpRequestTags(uri: string, verb: string) { }
    addProviderCommandTags(address: string, schema: string, tenant: string) { }
    addServiceCommandTags(serviceName: string, serviceVersion: string) { }
    addCustomCommandTags(commandType: string, tags: { [key: string]: string }) { }
    addTag(key: string, value: string) {
    }
    injectHeaders(headers: (name: any, value?: string) => any) {
    }
    logError(error: Error, msg?: () => string) {
        Service.log.error(this.context, error, msg);
    }
    logInfo(msg: () => string) {
        Service.log.info(this.context, msg);
    }
    logVerbose(msg: () => string) {
        Service.log.verbose(this.context, msg);
    }
    dispose() {
    }
}