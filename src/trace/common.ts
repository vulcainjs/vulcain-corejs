
export enum SpanKind {
    Request,
    Command,
    Task,
    Event
}

export class SpanId {
    public traceId?: string;
    public parentId: string;
    public spanId: string;
}

export interface ISpanTracker {
    trackAction(name: string, tags?: any);
    durationInMs: number;
    now: number;
    addTags(tags: any);
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
    createCommandTracker(commandName: string): ISpanRequestTracker;
}

export class DummySpanTracker implements ISpanRequestTracker {
    durationInMs: number = 0;
    now: number;

    createCommandTracker(commandName: string): ISpanRequestTracker {
        return this;
    }

    trackAction(name: string, tags?: any) {

    }
    addTags(tags: any) {

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