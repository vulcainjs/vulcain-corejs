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

    static async getAsync<T=ICommand>(commandKey: string, container: IContainer): Promise<T>;
    static async getAsync<T=ICommand>(commandKey: string, context: IRequestContext, schema?: string): Promise<T>;
    static async getAsync<T=ICommand>(commandKey: string, contextOrContainer: IRequestContext | IContainer, schema?: string): Promise<T> {
        let cache = hystrixCommandsCache.get(commandKey);
        if (cache) {
            let container: IContainer;
            let context: IRequestContext;
            if (contextOrContainer instanceof RequestContext) {
                context = contextOrContainer;
                container = context.container;
            }
            else {
                container = <IContainer>contextOrContainer;
                context = new RequestContext(container, Pipeline.Test);
            }
            let resolvedCommand = container.resolve(cache.command);
            let cmd = new HystrixCommand(cache.properties, resolvedCommand, <RequestContext>context, container);
            await cmd.setSchemaOnCommandAsync(schema);
            return <T><any>cmd;
        }
    }

    static resetCache() {
        hystrixCommandsCache.clear();
    }
}
