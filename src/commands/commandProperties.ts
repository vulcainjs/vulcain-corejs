import { CommandConfiguration } from './commandFactory';
import { Conventions } from './../utils/conventions';
import { IDynamicProperty } from './../configurations/dynamicProperty';
import { System } from '../configurations/globals/system';

let HystrixPropertiesNames = {
    HYSTRIX_HEALTH_SNAPSHOT_IN_MS: "hystrix.health.snapshot.validityInMilliseconds",
    HYSTRIX_FORCE_CIRCUIT_OPEN: "hystrix.force.circuit.open",
    HYSTRIX_FORCE_CIRCUIT_CLOSED: "hystrix.force.circuit.closed",
    HYSTRIX_CIRCUIT_ENABLED: "hystrix.circuit.enabled",
    HYSTRIX_CIRCUIT_SLEEP_WINDOW_IN_MS: "hystrix.circuit.sleepWindowInMilliseconds",
    HYSTRIX_CIRCUIT_ERROR_THRESHOLD_PERCENTAGE: "hystrix.circuit.errorThresholdPercentage",
    HYSTRIX_CIRCUIT_VOLUME_THRESHOLD: "hystrix.circuit.volumeThreshold",

    HYSTRIX_EXECUTION_TIMEOUT_IN_MS: "hystrix.execution.timeoutInMilliseconds",
    HYSTRIX_METRICS_STATISTICAL_WINDOW_IN_MS: "hystrix.metrics.statistical.window.timeInMilliseconds",
    HYSTRIX_METRICS_STATISTICAL_WINDOW_BUCKETS: "hystrix.metrics.statistical.window.bucketsNumber",
    HYSTRIX_METRICS_PERCENTILE_WINDOW_IN_MS: "hystrix.metrics.percentile.window.timeInMilliseconds",
    HYSTRIX_METRICS_PERCENTILE_WINDOW_BUCKETS: "hystrix.metrics.percentile.window.bucketsNumber",

    HYSTRIX_FALLBACK_VOLUME_REJECTION_THRESHOLD: "hystrix.isolation.semaphore.maxConcurrentRequests",
    HYSTRIX_REQUEST_VOLUME_REJECTION_THRESHOLD: "hystrix.fallback.semaphore.maxConcurrentRequests"
};

export class CommandProperties {

    /// <summary>
    /// If true the <see cref="circuitBreaker.AllowRequest"/> will always return true to allow requests regardless of the error percentage from <see cref="CommandMetrics.GetHealthCounts"/>.
    /// <p>
    /// The <see cref="CircuitBreakerForceOpen"/> property takes precedence so if it set to true this property does nothing.
    /// </summary>
    public circuitBreakerForceClosed: IDynamicProperty<boolean>;

    /// <summary>
    ///  If true the <see cref="circuitBreaker.AllowRequest"/> will always return false, causing the circuit to be open (tripped) and reject all requests.
    ///  <p>
    ///  This property takes precedence over <see cref="CircuitBreakerForceClosed"/>;
    /// </summary>
    public circuitBreakerForceOpen: IDynamicProperty<boolean>;

    /// <summary>
    ///  Minimum number of requests in the <see cref="MetricsRollingStatisticalWindowInMilliseconds"/> that must exist before the <see cref="circuitBreaker"/> will trip.
    ///  <p>
    ///  If below this number the circuit will not trip regardless of error percentage.
    /// </summary>
    public circuitBreakerRequestVolumeThreshold: IDynamicProperty<number>;

    /// <summary>
    ///  Error percentage threshold (as whole number such as 50) at which point the circuit breaker will trip open and reject requests.
    ///  <p>
    ///  It will stay tripped for the duration defined in <see cref="CircuitBreakerSleepWindowInMilliseconds"/>;
    ///  <p>
    ///  The error percentage this is compared against comes from <see cref="CommandMetrics.GetHealthCounts"/>.
    /// </summary>
    public circuitBreakerErrorThresholdPercentage: IDynamicProperty<number>;

    /// <summary>
    ///  The time in milliseconds after a <see cref="circuitBreaker"/> trips open that it should wait before trying requests again.
    /// </summary>
    public circuitBreakerSleepWindowInMilliseconds: IDynamicProperty<number>;

    /// <summary>
    ///  Number of concurrent requests permitted to <see cref="Command.GetFallback"/>. Requests beyond the concurrent limit will fail-fast and not attempt retrieving a fallback.
    /// </summary>
    public fallbackIsolationSemaphoreMaxConcurrentRequests: IDynamicProperty<number>;

    /// <summary>
    ///  Number of concurrent requests permitted to <see cref="Command.run"/>. Requests beyond the concurrent limit will be rejected.
    ///  <p>
    ///  Applicable only when <see cref="ExecutionIsolationStrategy"/> == SEMAPHORE.
    /// </summary>
    public executionIsolationSemaphoreMaxConcurrentRequests: IDynamicProperty<number>;

    /// <summary>
    ///  Whether to use a <see cref="circuitBreaker"/> or not. If false no circuit-breaker logic will be used and all requests permitted.
    ///  <p>
    ///  This is similar in effect to <see cref="CircuitBreakerForceClosed"/> except that continues tracking metrics and knowing whether it
    ///  should be open/closed, this property results in not even instantiating a circuit-breaker.
    /// </summary>
    public circuitBreakerEnabled: IDynamicProperty<boolean>;

    /// <summary>
    ///  Duration of statistical rolling window in milliseconds. This is passed into <see cref="RollingNumber"/> inside <see cref="CommandMetrics"/>.
    /// </summary>
    public metricsRollingStatisticalWindowInMilliseconds: IDynamicProperty<number>;

    /// <summary>
    ///  Whether <see cref="Command.GetCacheKey"/> should be used with <see cref="RequestCache"/> to provide de-duplication functionality via request-scoped caching.
    /// </summary>
    ///  @return {@code Property<Boolean>}
    ///
    public requestCacheEnabled: IDynamicProperty<boolean>;

    /// <summary>
    ///  Whether <see cref="ServiceCommand"/> execution and events should be logged to <see cref="RequestLog"/>.
    /// </summary>
    ///  @return {@code Property<Boolean>}
    ///
    public requestLogEnabled: IDynamicProperty<boolean>;

    /// <summary>
    ///  Number of buckets the rolling statistical window is broken into. This is passed into <see cref="RollingNumber"/> inside <see cref="CommandMetrics"/>.
    /// </summary>
    public metricsRollingStatisticalWindowBuckets: IDynamicProperty<number>;

    /// <summary>
    ///  Number of buckets the rolling percentile window is broken into. This is passed into <see cref="RollingPercentile"/> inside <see cref="CommandMetrics"/>.
    /// </summary>
    public metricsRollingPercentileWindowBuckets: IDynamicProperty<number>;

    /// <summary>
    ///  Duration of percentile rolling window in milliseconds. This is passed into <see cref="RollingPercentile"/> inside <see cref="CommandMetrics"/>.
    /// </summary>
    public metricsRollingPercentileWindowInMilliseconds: IDynamicProperty<number>;

    /// <summary>
    ///  Whether percentile metrics should be captured using <see cref="RollingPercentile"/> inside <see cref="CommandMetrics"/>.
    /// </summary>
    //public metricsRollingPercentileEnabled: IDynamicProperty<boolean>;

    /// <summary>
    ///  Maximum number of values stored in each bucket of the rolling percentile. This is passed into <see cref="RollingPercentile"/> inside <see cref="CommandMetrics"/>.
    ///
    /// </summary>
    //public metricsRollingPercentileBucketSize: IDynamicProperty<number>;
    /// <summary>
    ///  Time in milliseconds to wait between allowing health snapshots to be taken that calculate success and error percentages and affect <see cref="circuitBreaker.isOpen"/> status.
    ///  <p>
    ///  On high-volume circuits the continual calculation of error percentage can become CPU intensive thus this controls how often it is calculated.
    /// </summary>
    //public metricsHealthSnapshotIntervalInMilliseconds;

    /// <summary>
    ///  Timeout is ms
    /// </summary>
    public executionTimeoutInMilliseconds: IDynamicProperty<number>;

    constructor(public commandName: string, public commandGroup: string, config: CommandConfiguration) {
        if (!commandName) {
            throw new Error("Please provide a unique command key for the metrics.");
        }
        this.commandGroup = this.commandGroup || "hystrix";
        this.metricsRollingPercentileWindowBuckets = this.get<number>(HystrixPropertiesNames.HYSTRIX_METRICS_PERCENTILE_WINDOW_BUCKETS, "number");
        this.circuitBreakerForceClosed = this.get<boolean>(HystrixPropertiesNames.HYSTRIX_FORCE_CIRCUIT_CLOSED, "boolean", config.circuitBreakerForceClosed);
        this.circuitBreakerForceOpen = this.get<boolean>(HystrixPropertiesNames.HYSTRIX_FORCE_CIRCUIT_OPEN, "boolean", config.circuitBreakerForceOpened);
        this.circuitBreakerSleepWindowInMilliseconds = this.get<number>(HystrixPropertiesNames.HYSTRIX_CIRCUIT_SLEEP_WINDOW_IN_MS, "number", config.circuitBreakerSleepWindowInMilliseconds);
        this.circuitBreakerErrorThresholdPercentage = this.get<number>(HystrixPropertiesNames.HYSTRIX_CIRCUIT_ERROR_THRESHOLD_PERCENTAGE, "number", config.circuitBreakerErrorThresholdPercentage);
        this.circuitBreakerRequestVolumeThreshold = this.get<number>(HystrixPropertiesNames.HYSTRIX_CIRCUIT_VOLUME_THRESHOLD, "number", config.circuitBreakerRequestVolumeThreshold);
        this.executionTimeoutInMilliseconds = this.get<number>(HystrixPropertiesNames.HYSTRIX_EXECUTION_TIMEOUT_IN_MS, "number", config.executionTimeoutInMilliseconds);
        this.metricsRollingStatisticalWindowBuckets = this.get<number>(HystrixPropertiesNames.HYSTRIX_METRICS_STATISTICAL_WINDOW_BUCKETS, "number", config.statisticalWindowNumberOfBuckets);
        this.metricsRollingStatisticalWindowInMilliseconds = this.get<number>(HystrixPropertiesNames.HYSTRIX_METRICS_STATISTICAL_WINDOW_IN_MS, "number", config.metricsRollingStatisticalWindowInMilliseconds);
        this.metricsRollingPercentileWindowInMilliseconds = this.get<number>(HystrixPropertiesNames.HYSTRIX_METRICS_PERCENTILE_WINDOW_IN_MS, "number", config.metricsRollingPercentileWindowInMilliseconds);
        this.executionIsolationSemaphoreMaxConcurrentRequests = this.get<number>(HystrixPropertiesNames.HYSTRIX_REQUEST_VOLUME_REJECTION_THRESHOLD, "number");
        this.fallbackIsolationSemaphoreMaxConcurrentRequests = this.get<number>(HystrixPropertiesNames.HYSTRIX_FALLBACK_VOLUME_REJECTION_THRESHOLD, "number");
        //  this.metricsHealthSnapshotIntervalInMilliseconds = this.get<number>(HystrixPropertiesNames.HYSTRIX_FALLBACK_VOLUME_REJECTION_THRESHOLD);
        this.circuitBreakerEnabled = this.get<boolean>(HystrixPropertiesNames.HYSTRIX_CIRCUIT_ENABLED, "boolean", config.circuitEnabled);
    }

    private get<TValue>(name: string, schema: string, defaultValue?: TValue) {
        return System.createServiceConfigurationProperty<TValue>(
            this.commandName + "." + name,
            defaultValue || Conventions.instance.hystrix[name]);
    }
}
