import { CircuitBreakerFactory } from "./circuitBreaker";
import { HystrixCommand } from "./command";
import { ICommand } from './abstractCommand';
import { CommandProperties } from './commandProperties';
import { IContainer } from '../di/resolvers';
import { IRequestContext } from "../pipeline/common";
import { RequestContext } from "../pipeline/requestContext";
import { CommandMetricsFactory } from "./metrics/commandMetricsFactory";
import { Service } from './../globals/system';
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
        Preloader.instance.registerHandler(command, (container, domain: Domain) => {
            CommandFactory.registerCommand(command, config, commandKey, commandGroup);
        });
    };
}

interface CommandCache {
    command;
    properties: CommandProperties;
}

export class CommandFactory {
    /**
     * Register a new command
     */
    static registerCommand(command: Function, config: CommandConfiguration, commandKey?: string, commandGroup?: string) {
        commandGroup = commandGroup || Service.fullServiceName;
        commandKey = commandKey || command.name;

        if (!hystrixCommandsCache.has(commandKey)) {
            let properties = new CommandProperties(commandKey, commandGroup, config);
            CommandMetricsFactory.getOrCreate(properties); // register command - do not delete this line
            CircuitBreakerFactory.getOrCreate(properties); // register command - do not delete this line
            hystrixCommandsCache.set(commandKey, { properties, command });
        }
    }

    /**
     * Create a new command instance
     * Throws an exception if the command is unknown
     *
     * @param {IRequestContext} context current context
     * @param {string} name Command name
     * @param {any} args Command constructor arguments
     * @returns {ICommand} A command
     */
    static createCommand<T=ICommand>(context: IRequestContext, commandName: string, ...args): T {
        if (!context)
            throw new Error("Command can be used only within a context");

        let cache = hystrixCommandsCache.get(commandName);
        if (cache) {
            let container = context.container;

            let schema = (args && args.length > 0 && args[0]) || null;
            let resolvedCommand = container.resolve(cache.command, args);

            return new Proxy(resolvedCommand, {
                get(ctx, name) {
                    let handler = <Function>ctx[name];
                    if (!handler)
                        throw new Error(`Method ${name} doesn't exist in command ${resolvedCommand.name}`);

                    return function (...args) {
                        let cmd = new HystrixCommand(cache.properties, resolvedCommand, handler, <RequestContext>context, container, args);
                        schema && cmd.setSchemaOnCommand(schema);
                        return cmd.run();
                    };
                }
            });
        }
    }
}
