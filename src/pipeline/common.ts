import { SecurityManager, UserContext } from '../security/securityManager';
import { IContainer } from '../di/resolvers';
import { ICommand } from "../commands/abstractCommand";
import { HttpRequest } from "./vulcainPipeline";
import { ISpanTracker } from '../trace/common';

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

export interface IRequestContext extends ISpanTracker {
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
     * @param {string} [schema] Optional schema used to initialize the provider
     * @returns {ICommand} A command
     */
    getCommandAsync<T = ICommand>(name: string, schema?: string): Promise<T>
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