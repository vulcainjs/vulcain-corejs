import { System } from './../globals/system';
import { IDynamicProperty } from './../dynamicProperty';
import * as util from 'util';
import * as os from 'os';
import { Logger } from "./logger";
import { IRequestContext } from "../../pipeline/common";
import { RequestContext } from "../../pipeline/requestContext";

export type EntryKind = "RR"  // receive request
    | "Log"     // normal log
    | "BC"      // begin command
    | "EC"      // end command
    | "ER"      // end request
    | "RE"      // Receive event
    | "EE"      // end event
    ;

interface LogEntry {
    correlationId: string;
    parentId: string;
    traceId: string;
    service: string;
    version: string;
    source: string; // container
    message?: string;
    timestamp: number;
    kind: EntryKind;
    action: string;
    error?: string;
    stack?: string;
}

export class VulcainLogger implements Logger{

    private static _enableInfo: IDynamicProperty<boolean>;
    private _hostname: string;

    private static get enableInfo() {
        if (!VulcainLogger._enableInfo)
            VulcainLogger._enableInfo = System && System.createServiceConfigurationProperty("enableVerboseLog", false);
        return VulcainLogger._enableInfo.value;
    }

    constructor() {
        this._hostname = os.hostname();
    }

    /**
     * Log an error
     *
     * @param {any} requestContext Current requestContext
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     * @memberOf VulcainLogger
     */
    error(requestContext: IRequestContext, error: Error, msg?: ()=>string) {
        if (!error) return;
        let entry = this.prepareEntry(requestContext);
        entry.message = (msg && msg()) || "Error occured";
        entry.error = error.message;
        entry.stack = (error.stack || "").replace(/[\r\n]/g, '↵');

        this.writeEntry(entry);
    }

    /**
     * Log a message
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     * @memberOf VulcainLogger
     */
    info(requestContext: IRequestContext, msg: ()=>string) {
        let entry = this.prepareEntry(requestContext);
        entry.message = msg && msg();
        this.writeEntry(entry);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     * @memberOf VulcainLogger
     */
    verbose(requestContext: IRequestContext, msg: ()=>string) {
        if (VulcainLogger.enableInfo || System.isDevelopment)
            this.info(requestContext, msg);
    }

    logRequestStatus(requestContext: IRequestContext, kind: EntryKind) {
        let entry = this.prepareEntry(requestContext);
        entry.kind = kind;
        this.writeEntry(entry);
    }

    logAction(requestContext: IRequestContext, kind: EntryKind, action?: string, message?: string) {
        let entry = this.prepareEntry(requestContext);
        entry.kind = kind;
        entry.action = action;
        entry.message = message;
        this.writeEntry(entry);
    }

    private prepareEntry(requestContext: IRequestContext) {
        const ctx = <RequestContext>requestContext;
        return <LogEntry>{
            service: System.serviceName,
            version: System.serviceVersion,
            kind: "Log",
            source: this._hostname,
            timestamp: (ctx && ctx.metrics && ctx.metrics.now()) || Date.now() * 1000,
            correlationId: (requestContext && requestContext.correlationId) || undefined,
            //parentId: (requestContext && requestContext.parentId) || undefined,
            //traceId: (requestContext && requestContext.traceId) || undefined
        };
    }

    private writeEntry(entry: LogEntry) {

        if (System.isDevelopment) {
            util.log(`${entry.message} - ${JSON.stringify(entry)}`);
        }
        else {
            util.log( JSON.stringify(entry));
        }
    }
}
