import * as fs from 'fs';
import { System } from 'vulcain-configurationsjs';

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
                if (fs.statSync("vulcain.conventions")) {
                    const data = JSON.parse(fs.readFileSync("vulcain.conventions", "utf8"));
                    Conventions.deepAssign(data, Conventions._instance);
                }
            }
            catch (e) {
                System.log.error(null, e, "Error when reading vulcain.conventions file. Custom conventions are ignored.")
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

    /**
     * Environment variable for rabbit server address
     *
     */
    ENV_RABBIT_SERVER = "VULCAIN_RABBIT_SERVER";
    ENV_TOKEN_ISSUER = "VULCAIN_TOKEN_ISSUER";
    ENV_TOKEN_EXPIRATION = "VULCAIN_TOKEN_EXPIRATION";
    ENV_SECRET_KEY = "VULCAIN_SECRET_KEY";
    ENV_PRIVATE_KEY_PATH = "VULCAIN_PRIVATE_KEY_PATH";
    ENV_METRICS_AGENT = "VULCAIN_METRICS_AGENT";

    ENV_TENANT = "VULCAIN_TENANT";

    ENV_SERVICE_NAME = "VULCAIN_SERVICE_NAME";
    ENV_SERVICE_VERSION = "VULCAIN_SERVICE_VERSION";

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