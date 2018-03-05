import { CircuitBreakerFactory } from "./circuitBreaker";
import { HystrixCommand } from "./command";
import { ICommand, AbstractCommand } from './abstractCommand';
import { CommandProperties } from './commandProperties';
import { IContainer } from '../di/resolvers';
import { IRequestContext } from "../pipeline/common";
import { RequestContext } from "../pipeline/requestContext";
import { CommandMetricsFactory } from "./metrics/commandMetricsFactory";
import { Service } from './../globals/system';
import { Preloader } from "../preloader";
import { Domain } from '../schemas/domain';
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
const entryPointSymbol = Symbol("[[commandEntryPoints]]");

/**
 * Command attribute
 */
export function Command(config: CommandConfiguration = {}, commandKey?: string, commandGroup?: string) {

    return function (command: Function): any {
        return CommandFactory.declareCommand(command, config, commandKey, commandGroup);
    };
}


export function CommandEntryPoint(ignore=false) {
    return function (command, key: string, pdesc: PropertyDescriptor) {
        let endpoints = command.constructor[entryPointSymbol] || {};
        endpoints[key] = !ignore;
        command.constructor[entryPointSymbol] = endpoints;
    };
}

interface CommandCache {
    command;
    properties: CommandProperties;
}

export class CommandFactory {
    /**
     * for test only
     */
    static reset() {
        hystrixCommandsCache.clear();
        CommandMetricsFactory.resetCache();
        CircuitBreakerFactory.resetCache();
    }

    /**
     * Declare a command. All commands must be declared.
     * Do not use this method directly, use @Command 
     */
    static declareCommand(command: Function, config: CommandConfiguration, commandKey?: string, commandGroup?: string) {
        commandGroup = commandGroup || Service.fullServiceName;
        commandKey = commandKey || command.name;

        if (!hystrixCommandsCache.has(commandKey)) {
            let properties = new CommandProperties(commandKey, commandGroup, config);
            CommandMetricsFactory.getOrCreate(properties); // register command - do not delete this line
            CircuitBreakerFactory.getOrCreate(properties); // register command - do not delete this line
            
            let cmd = class extends (command as { new(context: IRequestContext, ...args): any }) {
                constructor(context: IRequestContext, ...args) {
                    super(context, ...args);
                    let self = <any>this;
                    return CommandFactory.createProxy(context, commandKey || command.name, self);
                }
            };

            hystrixCommandsCache.set(commandKey, { properties, command: cmd });
            return cmd;
        }
    }

    /**
    * Create a new command instance. Do not use it directly, use new instead
    * Throws an exception if the command is unknown
    *
    * @param {IRequestContext} context current context
    * @param {string} name Command name
    * @param {any} args Command constructor arguments
    * @returns {ICommand} A command or null
    */
    static createDynamicCommand<T=ICommand>(context: IRequestContext, commandName: string, ...args): T {
        let proxy = CommandFactory.createProxy(context, commandName, null);
        return proxy ? <T>new proxy(context, ...args) : null;
    }

    /**
     * Create a command proxy to encapsulate command class into a HystrixCommand
     */
    static createProxy<T=ICommand>(context: IRequestContext, commandName: string, command?): { new(context: IRequestContext, ...args): any } {
        if (!context)
            throw new Error("Command can be used only within a context");

        let container = context.container;
        let cache = hystrixCommandsCache.get(commandName);

        if (!cache)
            return null;
        
        command = command || cache.command;
        let proxy = new Proxy(command, {
            get(ctx, name) {
                let handler = <Function>ctx[name];
                if (name !== "run") {
                    if (!handler || typeof name !== "string")
                        return handler;
                    
                    let endPoints = command.constructor[entryPointSymbol];
                    if (!endPoints || !endPoints[name])
                        return handler;
                }
                
                if (!handler) throw new Error(`Method ${name} doesn't exist in command ${commandName}`);
                
                return function (...args) {
                    let cmd = new HystrixCommand(cache.properties, command, handler, <RequestContext>context, container, args);
                    return cmd.run();
                };
            }
        });
        return proxy;
    }
}
