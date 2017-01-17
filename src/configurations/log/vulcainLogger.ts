import { System } from './../globals/system';
import { IDynamicProperty } from './../dynamicProperty';
import * as util from 'util';
import { RequestContext } from '../../servers/requestContext';
import * as os from 'os';

export type entryKind = "RR"  // receive request
    | "Log"     // normal log
    | "BC"      // begin command
    | "EC"      // end command
    | "ER"      // end request
    | "RE"      // Receive event
    | "EE"      // end event
    ;

interface LogEntry {
    correlationId: string;
    correlationPath: string;
    service: string;
    version: string;
    source: string; // container
    message?: string;
    timestamp: number;
    kind: entryKind; // end request
    action: string;
    error?: string;
}

export class VulcainLogger {

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
    error(requestContext: RequestContext, error: Error, msg?: string) {
        if (!error) return;
        let entry = this.prepareEntry(requestContext);
        entry.message = msg || "Error occured";
        entry.error = (error.stack || error.message).replace(/[\r\n]/g, '↵');

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
    info(requestContext: RequestContext, msg: string, ...params: Array<any>) {
        let entry = this.prepareEntry(requestContext);
        entry.message = util.format(msg, ...params);
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
    verbose(requestContext: RequestContext, msg: string, ...params: Array<any>) {
        if (VulcainLogger.enableInfo || System.isDevelopment)
            this.info(requestContext, msg, params);
    }

    logRequestStatus(requestContext: RequestContext, kind: entryKind) {
        let entry = this.prepareEntry(requestContext);
        entry.kind = kind;
        this.writeEntry(entry);
    }

    logAction(requestContext: RequestContext, kind: entryKind, action?: string, message?: string) {
        let entry = this.prepareEntry(requestContext);
        entry.kind = kind;
        entry.action = action;
        entry.message = message;
        this.writeEntry(entry);
    }

    private now() {
        const hrtime = process.hrtime();
        const elapsedMicros = Math.floor(hrtime[0] * 1000000 + hrtime[1] / 1000);
        return elapsedMicros;
    }

    private prepareEntry(requestContext: RequestContext) {
        return <LogEntry>{
            service: System.serviceName,
            version: System.serviceVersion,
            kind: "Log",
            source: "", // TODO
            timestamp: this.now(),
            correlationId: (requestContext && requestContext.correlationId) || null,
            correlationPath: (requestContext && requestContext.correlationPath) || null
        };
    }

    private writeEntry(entry: LogEntry) {

        if (System.isDevelopment) {
            util.log(`${entry.correlationId}:${entry.correlationPath} - ${entry.message || (entry && JSON.stringify(entry))}`);
        }
        else {
            console.log("%j", entry);
        }
    }
}
