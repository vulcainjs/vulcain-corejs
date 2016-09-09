/**
 * Conventions values
 * You can override this values before instanciating application
 *
 * @export
 * @class Conventions
 */
export class Conventions {
    /**
     * Default api source files
     *
     * @static
     */
    static defaultApplicationFolder = "/api";
    static defaultModelsFolderPattern = "${base}/models";
    static defaultHandlersFolderPattern = "${base}/handlers";
    static defaultServicesFolderPattern = "${base}/services";
    static defaultHystrixPath = "/hystrix.stream";
    static defaultUrlprefix = "/api";

    /**
     * Environment variable for rabbit server address
     *
     * @static
     */
    static ENV_RABBIT_SERVER = "VULCAIN_RABBIT_SERVER";
    static ENV_TOKEN_ISSUER = "VULCAIN_TOKEN_ISSUER";
    static ENV_TOKEN_EXPIRATION = "VULCAIN_TOKEN_EXPIRATION";
    static ENV_SECRET_KEY = "VULCAIN_SECRET_KEY";
    static ENV_PRIVATE_KEY_PATH = "VULCAIN_PRIVATE_KEY_PATH";
    static ENV_METRICS_AGENT = "VULCAIN_METRICS_AGENT";

    static ENV_TENANT = "VULCAIN_TENANT";

    static ENV_SERVICE_NAME = "VULCAIN_SERVICE_NAME";
    static ENV_SERVICE_VERSION = "VULCAIN_SERVICE_VERSION";
}