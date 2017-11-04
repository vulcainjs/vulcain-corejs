import { SecurityContext, UserContext } from '../security/securityContext';
import { IContainer } from '../di/resolvers';
import { ICommand } from "../commands/abstractCommand";
import { HttpRequest } from "./vulcainPipeline";
import { ISpanTracker } from '../trace/common';
import { DefaultCRUDCommand } from '../defaults/crudHandlers';

export enum Pipeline {
    Event,
    AsyncTask,
    HttpRequest,
    Test
}

/**
 * Internal use
 *
 * @export
 * @interface ICustomEvent
 */
export interface ICustomEvent {
    action: string;
    schema?: string;
    params?: any;
}

export interface IRequestContext {
    /**
     * Span tracker
     */
    tracker: ISpanTracker;

    /**
     * Current user or null
     *
     * @type {UserContext}
     */
    user: UserContext;

    /**
     * Scoped container
     *
     * @type {IContainer}
     */
    container: IContainer;

    /**
     * Current locale
     *
     * @type {string}
     * @memberOf RequestContext
     */
    locale: string;

    /**
     * Request host name
     *
     * @type {string}
     * @memberOf RequestContext
     */
    hostName: string;
    requestData: RequestData;
    request?: HttpRequest;

    /**
     * Send custom event from current service
     *
     * @param {string} action action event
     * @param {*} [params] action parameters
     * @param {string} [schema] optional schema
     */
    sendCustomEvent(action: string, params?: any, schema?: string);

    /**
     * Create a new command
     * Throws an exception if the command is unknown
     *
     * @param {string} name Command name
     * @returns {ICommand} A command
     */
    getCommand<T = ICommand>(name: string, ...args): T;
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

export interface RequestData {
    vulcainVerb: string;
    correlationId: string;
    action: string;
    domain: string;
    schema: string;
    params?: any;
    maxByPage?: number;
    page?: number;
    inputSchema?: string;
    body?: any;
}