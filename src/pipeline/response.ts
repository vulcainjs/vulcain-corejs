/**
 * This class provide a way to customize the http response.
 *
 * @export
 * @class HttpResponse
 */
import { ApplicationError } from "./errors/applicationRequestError";
import { RequestContext } from "./requestContext";
import { System } from "./../globals/system";
import { ErrorResponse } from "./handlers/common";

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
     * @type {any}
     * @memberOf HttpResponse
     */
    public headers: any;
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

    /**
     * Content encoding (like binary, hex,...)
     *
     * @type {string}
     * @memberOf HttpResponse
     */
    public encoding: string;

  /*  static createFromResponse(data): HttpVulcainResponse {
        let res = new HttpVulcainResponse(data.content, data.statusCode);
        res.encoding = data.encoding;
        res.contentType = data.contentType;
        res.headers = data.headers;
        return res;
    }
*/
    static createFromError(err: ApplicationError): HttpResponse {
        let res = new HttpResponse({ error: { message: err.message, errors: err.errors }}, err.statusCode|| 500);
        return res;
    }

    constructor(content?, statusCode = 200) {
        this.headers = {};
        this.statusCode = statusCode;

       this.content = content;
    }

    /**
     * Add a custom header value to the response
     *
     * @param {string} name
     * @param {string} value
     */
    addHeader(name: string, value: string) {
        this.headers[name] = value;
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
