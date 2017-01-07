import { System } from './../globals/system';
import { IDynamicProperty } from './../dynamicProperty';
import * as util from 'util';

export class VulcainLogger {

    private static _enableInfo: IDynamicProperty<boolean>;

    private static get enableInfo() {
        if (!VulcainLogger._enableInfo)
            VulcainLogger._enableInfo = System && System.createServiceConfigurationProperty("enableVerboseLog", false);
        return VulcainLogger._enableInfo.value;
    }

    constructor() {
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
    error(requestContext, error: Error, msg?: string) {
        if (!error) return;
        let txt = (msg || "") + ": ";
        if (VulcainLogger.enableInfo || System.isTestEnvironnment) {
            txt = txt + (error.stack || error.message);
        }
        else {
            txt = txt + (error.message);
        }
        this.write(requestContext, txt);
    }

    /**
     * Log a message info
     *
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     * @memberOf VulcainLogger
     */
    info(requestContext, msg: string, ...params: Array<any>) {
        this.write(requestContext, util.format(msg, ...params));
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
    verbose(requestContext, msg: string, ...params: Array<any>) {
        if (VulcainLogger.enableInfo || System.isDevelopment)
            this.write(requestContext, util.format(msg, ...params));
    }

    /**
     * Don't use directly
     *
     * @param {any} requestContext
     * @param {any} info
     *
     * @memberOf VulcainLogger
     */
    write(requestContext, info) {
        let trace: any = {
            service: System.serviceName,
            version: System.serviceVersion,
            timestamp: System.nowAsString(),
            correlationId: (requestContext && requestContext.correlationId) || null,
            correlationPath: (requestContext && requestContext.correlationPath) || null
        };

        if (typeof info === "string")
        {
            trace.message = info;
        }
        else {
            trace.info = info;
        }
        if (System.isTestEnvironnment) {
            util.log(`${trace.correlationId}:${trace.correlationPath} - ${trace.message || (trace.info && JSON.stringify(trace.info))}`);
        }
        else {
            console.log("%j", trace);
        }
    }
}
