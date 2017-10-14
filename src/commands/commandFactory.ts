import { CircuitBreakerFactory } from "./circuitBreaker";
import { HystrixCommand } from "./command";
import { ICommand } from './abstractCommand';
import { CommandProperties } from './commandProperties';
import { IContainer } from '../di/resolvers';
import { IRequestContext } from "../pipeline/common";
import { RequestContext } from "../pipeline/requestContext";
import { CommandMetricsFactory } from "./metrics/commandMetricsFactory";
import { System } from './../globals/system';
import { Preloader } from "../preloader";
import { Domain } from '../schemas/schema';
import { Pipeline } from "../pipeline/common";

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
export function Command(config: CommandConfiguration = {}, commandKey?: string, commandGroup?: string) {

    return function (command: Function) {
        commandGroup = commandGroup || System.fullServiceName;
        commandKey = commandKey || command.name;
        Preloader.instance.registerHandler(command, (container, domain: Domain) => {
            let properties = new CommandProperties(commandKey, commandGroup, config);
            CommandMetricsFactory.getOrCreate(properties); // register command - do not delete this line
            CircuitBreakerFactory.getOrCreate(properties); // register command - do not delete this line
            hystrixCommandsCache.set(commandKey, { properties, command });
        });
    };
}

interface CommandCache {
    command;
    properties: CommandProperties;
}

export class CommandFactory {
    static getCommand<T=ICommand>(commandKey: string, context: IRequestContext, ...args): T {
        return CommandFactory.getProviderCommand(commandKey, context, null, args);
    }

    static getProviderCommand<T=ICommand>(commandKey: string, context: IRequestContext, schema: string, ...args): T {
        let cache = hystrixCommandsCache.get(commandKey);
        if (cache) {
            let container = context.container;

            let resolvedCommand = container.resolve(cache.command, args);

            return new Proxy(resolvedCommand, {
                get(ctx, name) {
                    let handler = <Function>ctx[name];
                    if (!handler)
                        throw new Error(`Method ${name} doesn't exist in command ${resolvedCommand.name}`);

                    return function (...args) {
                        let cmd = new HystrixCommand(cache.properties, resolvedCommand, handler, <RequestContext>context, container, args);
                        schema && cmd.setSchemaOnCommand(schema);
                        return cmd.runAsync();
                    };
                }
            });
        }
    }

    static resetCache() {
        hystrixCommandsCache.clear();
    }
}
