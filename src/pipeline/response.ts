/**
 * This class provide a way to customize the http response.
 *
 * @export
 * @class HttpResponse
 */
export class HttpResponse {
    static readonly VulcainContentType = "application/vulcain";

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

    /**
     * Content encoding (like binary, hex,...)
     *
     * @type {string}
     * @memberOf HttpResponse
     */
    public encoding: string;

    constructor(content?, statusCode=200) {
        this.headers = new Map<string, string>();
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

export class BadRequestResponse extends HttpResponse {
    constructor(content, status=400) {
        super(content, status);
        if (typeof content === "string") {
            this.content = {
                error: { message: content }
            };
        }
    }
}

export class VulcainResponse extends HttpResponse {
    constructor(content) {
        super(content);
        this.contentType = HttpResponse.VulcainContentType;
    }
}