import { UserContext } from '../security/securityContext';
import { IContainer } from '../di/resolvers';
import { ICommand } from "../commands/abstractCommand";
import { HttpRequest } from "./vulcainPipeline";
import { ISpanTracker, ITracker } from '../instrumentations/common';
import { Model } from '../schemas/builder/annotations.model';
import { Property} from '../schemas/builder/annotations.property';

export interface VulcainResponse<T=any> {
    meta: {
        correlationId: string;
        taskId?: string;
        status?: string;
        totalCount?: number;
        page?: number;
        pageSize?: number;
    };
    value: T;
}
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
    createCustomTracker(name: string, tags?: { [index: string]: string }): ITracker;

    /**
     * Span tracker
     */
    requestTracker: ITracker;

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
    parent: IRequestContext;
    /**
     * Send custom event from current service
     *
     * @param {string} action action event
     * @param {*} [params] action parameters
     * @param {string} [schema] optional schema
     */
    sendCustomEvent(action: string, params?: any, schema?: string);

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

    /**
     * Don't close the request (used by SSE request)
     */
    keepConnected: boolean;
    
    dispose();
}

export interface RequestData {
    vulcainVerb: string;
    correlationId: string;
    action: string;
    domain: string;
    schema: string;
    params?: any;
    pageSize?: number;
    page?: number;
    inputSchema?: string;
    body?: any;
}
