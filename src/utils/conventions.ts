import * as fs from 'fs';
import { System } from './../configurations/globals/system';

/**
 * Conventions values
 * You can override this values before instanciating application
 *
 * @export
 * @class Conventions
 */
export class Conventions {

    private static _instance: Conventions;

    static deepAssign(from, target) {
        from && Object.keys(from).forEach(k => {
            if (typeof from === "Object") {
                target[k] = target[k] || {};
                Conventions.deepAssign(from[k], target[k]);
            }
            else
                target[k] = from[k];
        });
    }

    static get instance() {
        if (!Conventions._instance) {
            Conventions._instance = new Conventions();
            try {
                if (fs.existsSync("vulcain.conventions")) {
                    const data = JSON.parse(fs.readFileSync("vulcain.conventions", "utf8"));
                    Conventions.deepAssign(data, Conventions._instance);
                }
            }
            catch (e) {
                System.log.error(null, e, "Error when reading vulcain.conventions file. Custom conventions are ignored.");
            }
        }
        return Conventions._instance;
    }

    /**
     * Default api source files
     *
     */
    defaultApplicationFolder = "/api";
    defaultModelsFolderPattern = "${base}/models";
    defaultHandlersFolderPattern = "${base}/handlers";
    defaultServicesFolderPattern = "${base}/services";
    defaultHystrixPath = "/hystrix.stream";
    defaultUrlprefix = "/api";
    defaultRabbitAddress = "rabbit";
    defaultMongoAddress = "mongo";
    defaultStatsdAddress = "telegraf";
    defaultStatsdDelayInMs = 10000;
    defaultVulcainServerName = "vulcain-server";
    vulcainFileName = ".vulcain";
    secretKeyPropertyName = "VulcainSecretKey";
    defaultSecretKey = "DnQBnCG7*fjEX@Rw5uN^hWR4*AkRVKMeRu2#Ucu^ECUNWrKr";
    defaultTokenExpiration = "20m";

    /**
     * Environment variable for rabbit server address
     *
     */
    ENV_TOKEN_ISSUER = "VULCAIN_TOKEN_ISSUER";
    ENV_TOKEN_EXPIRATION = "VULCAIN_TOKEN_EXPIRATION";
    ENV_VULCAIN_TENANT = "VULCAIN_TENANT";
    /**
     * Api key to get config from vulcain server
     *
     *
     * @memberOf Conventions
     */
    ENV_VULCAIN_TOKEN = "VULCAIN_TOKEN";
    ENV_VULCAIN_ENV = "VULCAIN_ENV";
    ENV_VULCAIN_DOMAIN = "VULCAIN_DOMAIN";
    ENV_VULCAIN_SERVER = "VULCAIN_SERVER";
    ENV_SERVICE_NAME = "VULCAIN_SERVICE_NAME";
    ENV_SERVICE_VERSION = "VULCAIN_SERVICE_VERSION";
    ENV_VULCAIN_TEST = "VULCAIN_TEST";
    ENV_VULCAIN_SECRET_KEY = "VULCAIN_SECRET_KEY";

    hystrix = {
        "hystrix.health.snapshot.validityInMilliseconds": 500,
        "hystrix.force.circuit.open": false,
        "hystrix.force.circuit.closed": false,
        "hystrix.circuit.enabled": true,
        "hystrix.circuit.sleepWindowInMilliseconds": 5000,
        "hystrix.circuit.errorThresholdPercentage": 50,
        "hystrix.circuit.volumeThreshold": 10,
        "hystrix.execution.timeoutInMilliseconds": 1500,
        "hystrix.metrics.statistical.window.timeInMilliseconds": 10000,
        "hystrix.metrics.statistical.window.bucketsNumber": 10,
        "hystrix.metrics.percentile.window.timeInMilliseconds": 10000,
        "hystrix.metrics.percentile.window.bucketsNumber": 10,
        "hystrix.isolation.semaphore.maxConcurrentRequests": 10,
        "hystrix.fallback.semaphore.maxConcurrentRequests": 10
    };
}
