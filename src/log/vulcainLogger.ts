import { System } from './../globals/system';
import { IDynamicProperty } from '../configurations/abstractions';
import * as util from 'util';
import * as os from 'os';
import { Logger } from "./logger";
import { IRequestContext } from "../pipeline/common";
import { RequestContext } from "../pipeline/requestContext";
import { ApplicationError } from '../pipeline/errors/applicationRequestError';

export type EntryKind = "RR"  // receive request
    | "Log"     // normal log
    | "RR"      // Receive request
    | "ER"      // end request
    | "RT"      // Receive task
    | "ET"      // End task
    | "BC"      // begin command
    | "EC"      // end command
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
    error?: string;
    stack?: string;
}

export class VulcainLogger implements Logger{

    private static _enableInfo: IDynamicProperty<boolean>;
    private _hostname: string;

    private static get enableInfo() {
        if (!VulcainLogger._enableInfo)
            VulcainLogger._enableInfo = System && System.createChainedConfigurationProperty("enableVerboseLog", false);
        return VulcainLogger._enableInfo.value;
    }

    constructor() {
        this._hostname = os.hostname();
    }

    /**
     * Log an error
     *
     * @param {any} context Current context
     * @param {Error} error Error instance
     * @param {string} [msg] Additional message
     *
     * @memberOf VulcainLogger
     */
    error(context: IRequestContext, error: Error, msg?: ()=>string) {
        if (!error) return;
        let entry = this.prepareEntry(context);
        entry.message = (msg && msg()) || "Error occured";
        entry.error = error.message;
        if(!(error instanceof ApplicationError))
            entry.stack = (error.stack || "").replace(/[\r\n]/g, '↵');

        this.writeEntry(entry);
    }

    /**
     * Log a message
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     * @memberOf VulcainLogger
     */
    info(context: IRequestContext, msg: ()=>string) {
        let entry = this.prepareEntry(context);
        entry.message = msg && msg();
        this.writeEntry(entry);
    }

    /**
     * Log a verbose message. Verbose message are enable by service configuration property : enableVerboseLog
     *
     * @param {any} context Current context
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     * @memberOf VulcainLogger
     */
    verbose(context: IRequestContext, msg: ()=>string) {
        if (VulcainLogger.enableInfo || System.isDevelopment)
            this.info(context, msg);
    }

    logAction(context: IRequestContext, kind: EntryKind, message?: string) {
        let entry = this.prepareEntry(context);
        entry.kind = kind;
        entry.message = message;
        this.writeEntry(entry);
    }

    private prepareEntry(context: IRequestContext) {
        const ctx = <RequestContext>context;
        return <LogEntry>{
            service: System.serviceName,
            version: System.serviceVersion,
            kind: "Log",
            source: this._hostname,
            timestamp: Date.now() * 1000,
            correlationId: (context && context.correlationId) || undefined,
            //parentId: (context && context.parentId) || undefined,
            //traceId: (context && context.traceId) || undefined
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
