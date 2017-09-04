import { SecurityManager, UserContext } from '../security/securityManager';
import { IContainer } from '../di/resolvers';
import { ICommand } from "../commands/abstractCommand";
import { HttpRequest } from "./vulcainPipeline";
import { CommandMetrics } from "./middlewares/metricsMiddleware";

export enum Pipeline {
    EventNotification,
    InProcess,
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
     * Request correlation id
     *
     * @type {string}
     */
    correlationId: string;

    /**
     * Current user or null
     *
     * @type {UserContext}
     */
    security: UserContext;
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
    metrics: CommandMetrics;

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
     * @param {string} [schema] Optional schema used to initialize the provider
     * @returns {ICommand} A command
     */
    getCommandAsync<T = ICommand>(name: string, schema?: string): Promise<T>
    
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
     * @param {any} requestContext Current requestContext
     * @param {string} msg Message format (can include %s, %j ...)
     * @param {...Array<string>} params Message parameters
     *
     */
    logVerbose(msg: () => string);
}

export interface RequestData {
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