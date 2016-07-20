import {CommandMetricsFactory} from "../metrics/commandMetrics";
import {CircuitBreakerFactory} from "./circuitBreaker";
import {HystrixCommand} from "./command";
import {AbstractCommand, ICommand} from './abstractCommand'
import {CommandProperties} from './commandProperties'

export interface CommandConfiguration {
    circuitEnabled?: boolean;
    circuitBreakerSleepWindowInMilliseconds?: number;
    circuitBreakerRequestVolumeThreshold?: number;
    executionIsolationSemaphoreMaxConcurrentRequests?: number;
    fallbackIsolationSemaphoreMaxConcurrentRequests?: number;
    circuitBreakerForceOpened?: boolean;
    circuitBreakerForceClosed?: boolean;
    statisticalWindowNumberOfBuckets?: number;
    statisticalWindowLength?: number;
    percentileWindowNumberOfBuckets?: number;
    percentileWindowLength?: number;
    circuitBreakerErrorThresholdPercentage?: number;
    executionTimeoutInMilliseconds?: number;
    metricsRollingStatisticalWindowInMilliseconds?: number;
    metricsRollingPercentileWindowInMilliseconds?: number;
}

const hystrixCommandsCache = new Map<string, CommandCache>();

/**
 * Command attribute
 */
export function Command(config: CommandConfiguration={}, commandKey?: string, commandGroup?: string) {

    return function (command: Function) {
        commandGroup = commandGroup || "hystrix";
        commandKey = commandKey || command.name;

        let properties = new CommandProperties(commandKey, commandGroup, config);
        let metrics = CommandMetricsFactory.getOrCreate(properties); // register command - do not delete this line
        let circuitBreaker = CircuitBreakerFactory.getOrCreate(properties); // register command - do not delete this line
        hystrixCommandsCache.set(commandKey, { properties, command });
    }
}

interface CommandCache {
    command;
    properties: CommandProperties;
}

export class CommandFactory {

    static get(commandKey: string, context?): ICommand {
        let cache = hystrixCommandsCache.get(commandKey);
        if (cache) {
            let resolvedCommand = context ? context.container.resolve(cache.command): new (<any>cache.command)();
            let cmd = new HystrixCommand(cache.properties, resolvedCommand, context);
            return cmd;
        }
        throw new Error(`Command ${commandKey} not found`);
    }

    static resetCache() {
        hystrixCommandsCache.clear();
    }
}