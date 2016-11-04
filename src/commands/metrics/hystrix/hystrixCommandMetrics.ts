import {RollingNumber} from "./rollingNumber";
import {RollingPercentile} from "./rollingPercentile";
import RollingNumberEvent from "./rollingNumberEvent";
import ActualTime from "../../../utils/actualTime";
import { CommandProperties } from '../../command/commandProperties';
import { ICommandMetrics } from '../../../commands/metrics/commandMetricsFactory';

export class HystrixCommandMetrics implements ICommandMetrics {
    private rollingCount: RollingNumber;
    public commandName: string;
    public commandGroup: string;
    private currentExecutionCount: number;
    private lastHealthCountsSnapshot;
    private percentileCount: RollingPercentile;
    public metricsRollingStatisticalWindowInMilliseconds: number;

    constructor( public properties: CommandProperties) {
        if (!properties)
            throw new Error("properties argument is required");

        this.currentExecutionCount = 0;
        this.commandName = properties.commandName;
        this.commandGroup = properties.commandGroup;
        this.lastHealthCountsSnapshot = ActualTime.getCurrentTime();
        this.metricsRollingStatisticalWindowInMilliseconds = properties.metricsRollingStatisticalWindowInMilliseconds.value;

        this.rollingCount = new RollingNumber(properties.metricsRollingStatisticalWindowInMilliseconds.value,
            properties.metricsRollingStatisticalWindowBuckets.value
        );
        this.percentileCount = new RollingPercentile(
            properties.metricsRollingPercentileWindowInMilliseconds.value,
            properties.metricsRollingPercentileWindowBuckets.value
        );
    }

    markFallbackSuccess() {
        this.rollingCount.increment(RollingNumberEvent.FALLBACK_SUCCESS);
    }
    markFallbackFailure() {
        this.rollingCount.increment(RollingNumberEvent.FALLBACK_FAILURE);
    }
    markFallbackRejection() {
        this.rollingCount.increment(RollingNumberEvent.FALLBACK_REJECTION);
    }
    markExceptionThrown() {
        this.rollingCount.increment(RollingNumberEvent.EXCEPTION_THROWN);
    }
    markBadRequest(duration: number) {
        this.rollingCount.increment(RollingNumberEvent.BAD_REQUEST);
    }
    markResponseFromCache() {
        this.rollingCount.increment(RollingNumberEvent.RESPONSE_FROM_CACHE);
    }
    markSuccess() {
        this.rollingCount.increment(RollingNumberEvent.SUCCESS);
    }

    markRejected() {
        this.rollingCount.increment(RollingNumberEvent.REJECTED);
    }

    markFailure() {
        this.rollingCount.increment(RollingNumberEvent.FAILURE);
    }

    markTimeout() {
        this.rollingCount.increment(RollingNumberEvent.TIMEOUT);
    }

    markShortCircuited() {
        this.rollingCount.increment(RollingNumberEvent.SHORT_CIRCUITED);
    }

    incrementExecutionCount() {
        ++this.currentExecutionCount;
    }

    decrementExecutionCount() {
        --this.currentExecutionCount;
    }

    getCurrentExecutionCount() {
        return this.currentExecutionCount;
    }

    addExecutionTime(time) {
        this.percentileCount.addValue(time);
    }

    getRollingCount(type) {
        return this.rollingCount.getRollingSum(type);
    }

    getExecutionTime(percentile) {
        return this.percentileCount.getPercentile(percentile);
    }

    getHealthCounts() {

        //TODO restrict calculation by time to avoid too frequent calls
        let success = this.rollingCount.getRollingSum(RollingNumberEvent.SUCCESS);
        let error = this.rollingCount.getRollingSum(RollingNumberEvent.FAILURE);
        let timeout = this.rollingCount.getRollingSum(RollingNumberEvent.TIMEOUT);
        let shortCircuited = this.rollingCount.getRollingSum(RollingNumberEvent.SHORT_CIRCUITED);
        let semaphoreRejected = this.rollingCount.getRollingSum(RollingNumberEvent.REJECTED);

        let totalCount = success + error + timeout + shortCircuited + semaphoreRejected;
        let errorCount = error + timeout + shortCircuited + semaphoreRejected;

        let errorPercentage = 0;
        if (totalCount > 0) {
            errorPercentage = errorCount / totalCount * 100;
        }

        return {
            totalCount: totalCount,
            errorCount: errorCount,
            errorPercentage: errorPercentage
        };
    }

    reset() {
        this.rollingCount.reset();
        this.lastHealthCountsSnapshot = ActualTime.getCurrentTime();
    }
}
