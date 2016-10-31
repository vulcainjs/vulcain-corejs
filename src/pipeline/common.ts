import {IContainer} from '../di/resolvers';
import {LifeTime} from '../di/annotations';
import {Domain} from '../schemas/schema';
import {UserContext} from '../servers/requestContext';

/**
 * This class provide a way to customize the http response.
 *
 * @export
 * @class HttpResponse
 */
export class HttpResponse {
    /**
     * Http code (default is 200)
     *
     * @type {number}
     * @memberOf HttpResponse
     */
    public statusCode: number;
    /**
     * List of response headers
     *
     * @type {Map<string, string>}
     * @memberOf HttpResponse
     */
    public headers: Map<string, string>;
    /**
     * Define a specific ContentType
     *
     * @type {string}
     * @memberOf HttpResponse
     */
    public contentType: string;
    /**
     * Response content
     *
     * @type {*}
     * @memberOf HttpResponse
     */
    public content: any;

    constructor() {
        this.headers = new Map<string, string>();
        this.statusCode = 200;
    }

        /**
     * Add a custom header value to the response
     *
     * @param {string} name
     * @param {string} value
     */
    addHeader(name: string, value: string) {
        this.headers.set(name, value);
    }
}

export class HttpRedirectResponse extends HttpResponse {
    constructor(url: string) {
        super();
        if (!url)
            throw new Error("Url is required");
        this.statusCode = 302;
        this.addHeader("Location", url);
    }
}

export interface ValidationError {
    id?: string;
    field?: string;
    message: string;
}

export interface ErrorResponse {
    message:string;
    errors?: Array<ValidationError>;
}

export interface CommonRequestData {
    correlationId: string;
    correlationPath: string;
    action: string;
    domain: string;
    schema: string;
    inputSchema?: string;
    userContext?: UserContext
    data: any;
}

export interface CommonRequestResponse<T> {
    tenant: string;
    userContext: UserContext,
    source: string;
    domain: string;
    action: string;
    schema: string;
    error?: ErrorResponse;
    value?: T;
    inputSchema?: string;
}

export interface CommonActionMetadata {
    description: string;
    action?: string;
    scope?: string;
    schema?: string|Function;
    inputSchema?: string | Function;
}

export interface CommonMetadata {
    description?: string;
    schema?: string|Function;
}

export interface CommonHandlerMetadata extends CommonMetadata {
    scope: string;
}

export interface ServiceHandlerMetadata extends CommonHandlerMetadata {
    serviceName?: string;
    serviceLifeTime?: LifeTime;
}

export interface IManager {
    container: IContainer;
    getInfoHandler<T>(command: CommonRequestData, container?: IContainer): { handler: Function, metadata: T, method: string, kind: "query" | "action" | "event" }
    runAsync(command: CommonRequestData, ctx): Promise<CommonRequestResponse<any>>;
}

export class HandlerFactory {

    static obfuscateSensibleData(domain: Domain, container: IContainer, result) {
        if (result) {
            if (Array.isArray(result)) {
                let outputSchema;
                result.forEach(v => {
                    if (v.__schema) {
                        if (!outputSchema || outputSchema.name !== v.__schema)
                            outputSchema = domain.getSchema(v.__schema);
                        if (outputSchema && outputSchema.description.hasSensibleData)
                            domain.obfuscate(v, outputSchema);
                    }
                });
            }
            else if (result.__schema) {
                let outputSchema = domain.getSchema(result.__schema);
                if (outputSchema && outputSchema.description.hasSensibleData)
                    domain.obfuscate(result, outputSchema);
            }
        }

        return result;
    }
}
