import * as fs from 'fs';
import { Service } from './../globals/system';
const Utils = require('jaeger-client/dist/src/util').default;

/**
 * Conventions values
 * You can override this values before instantiating application
 *
 * @export
 * @class Conventions
 */
export class Conventions {

    private static _instance: Conventions;

    static getRandomId() {
        return Utils.getRandom64().toString("hex");
    }

    static clone(source, target?) {
        if (!source || !(typeof source === "object")) {
            return source;
        }

        target = target || {};
        for (let key of Object.keys(source)) {
            let val = source[key];
            if (Array.isArray(val)) {
                target[key] = [];
                val.forEach(v => target[key].push(Conventions.clone(v)));
            }
            else {
                target[key] = Conventions.clone(val, target[key]);
            }
        }
        return target;
    }

    static get instance() {
        if (!Conventions._instance) {
            Conventions._instance = new Conventions();
            try {
                if (fs.existsSync("vulcain.conventions")) {
                    const data = JSON.parse(fs.readFileSync("vulcain.conventions", "utf8"));
                    Conventions.clone(data, Conventions._instance);
                }
            }
            catch (e) {
                Service.log.error(null, e, () => "Error when reading vulcain.conventions file. Custom conventions are ignored.");
            }
        }
        return Conventions._instance;
    }

    /**
     * Naming
     *
     */
    defaultApplicationFolder = "api";
    defaultHystrixPath = "/hystrix.stream";
    defaultUrlprefix = "/api";
    vulcainFileName = "vulcain.json";
    defaultGraphQLSubscriptionPath = "/api/_graphql.subscriptions";

    defaultStatsdDelayInMs = 10000;
    defaultSecretKey = "Dn~BnCG7*fjEX@Rw5uN^hWR4*AkRVKMe"; // 32 length random string
    defaultTokenExpiration = "20m"; // in moment format

    VULCAIN_SECRET_KEY = "vulcainSecretKey";
    TOKEN_ISSUER = "vulcainTokenIssuer";
    TOKEN_EXPIRATION = "vulcainTokenExpiration";
    ENV_VULCAIN_TENANT = "VULCAIN_TENANT";
    ENV_VULCAIN_DOMAIN = "VULCAIN_DOMAIN";
    ENV_SERVICE_NAME = "VULCAIN_SERVICE_NAME";
    ENV_SERVICE_VERSION = "VULCAIN_SERVICE_VERSION";
    ENV_VULCAIN_ENV = "VULCAIN_ENV"; // 'production', 'test' or 'local'

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
