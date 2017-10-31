import { IRequestContext } from "../pipeline/common";


export enum SpanKind {
    Request,
    Command,
    Task,
    Event
}

export interface TrackerInfo {
    correlationId?: string;
    parentId: string;
    spanId: string;
}

export interface ISpanTracker {
    trackAction(name: string, tags?: any);
    durationInMs: number;
    now: number;
    addTrackerTags(tags: any);
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

export interface ISpanHasId {
    id: TrackerInfo;
}

export interface ISpanRequestTracker extends ISpanTracker, ISpanHasId {
    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker;
}

export class DummySpanTracker implements ISpanRequestTracker {
    durationInMs: number = 0;
    now: number;

    get id(): TrackerInfo {
        return {spanId: "0", parentId: "0"};
    }

    createCommandTracker(context: IRequestContext, commandName: string): ISpanRequestTracker {
        return this;
    }

    trackAction(name: string, tags?: any) {

    }
    addTrackerTags(tags: any) {

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