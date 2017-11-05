import { CommandProperties } from './commandProperties';
import { CircuitBreakerFactory } from "./circuitBreaker";
import { AbstractCommand, ICommand } from './abstractCommand';
import { SemaphoreFactory, Semaphore } from './semaphore';
import { EventType, FailureType, ExecutionResult } from './executionResult';
import { System } from './../globals/system';
import { IContainer } from '../di/resolvers';
import { ICommandMetrics, CommandMetricsFactory } from "./metrics/commandMetricsFactory";
import { TimeoutError } from "../pipeline/errors/timeoutError";
import { CommandRuntimeError } from "../pipeline/errors/commandRuntimeError";
import { BadRequestError } from "../pipeline/errors/badRequestError";
import { RequestContext, CommandRequest } from '../pipeline/requestContext';
import { Span } from '../trace/span';

export interface CommandInfo {
    commandKey: string;
    commandGroup: string;
    timeout: number;
    isErrorHandler: (error: any) => any;
    metricsConfig: any;
    circuitConfig: any;
    requestVolumeRejectionThreshold: number;
}

export interface IHasFallbackCommand<T extends any> {
    fallback(...args): Promise<T>;
}

export class HystrixCommand {
    public status: ExecutionResult = new ExecutionResult();
    private running: boolean;
    private _arguments;
    private hystrixMetrics: ICommandMetrics;
    private schemaName: string;
    private command: AbstractCommand<any>;

    constructor(private properties: CommandProperties, command: AbstractCommand<any>, private handler: Function, context: RequestContext, container: IContainer, args) {
        this._arguments = args;
        this.command = command;
        command.container = container;
        this.command.context =  context.createCommandRequest(this.getCommandName());
        this.hystrixMetrics = CommandMetricsFactory.getOrCreate(properties);
        this.command.context.tracker.addTag("hystrixProperties", this.properties.toString());
    }

    get circuitBreaker() {
        return CircuitBreakerFactory.getOrCreate(this.properties);
    }

    get semaphore(): Semaphore {
        return SemaphoreFactory.getOrCreate(this.properties);
    }

    setSchemaOnCommand(schema: string) {
        if (schema && (<any>this.command).setSchema) {
            this.schemaName = (<any>this.command).setSchema(schema);
        }
    }

    async run<T>(): Promise<T> {
        if (this.running) {
            throw new Error("This instance can only be executed once. Please instantiate a new instance.");
        }
        this.running = true;

        let result;

        // Execution
        this.hystrixMetrics.incrementExecutionCount();
        let recordTotalTime = true;
        try {
            if (this.circuitBreaker.allowRequest()) {
                if (this.semaphore.canExecuteCommand()) {
                    try {
                        try {
                            // Execution
                            let executing = true;

                            let promises = [];
                            // Initialize command span
                            promises.push(this.handler.apply(this.command, this._arguments));
                            if (this.properties.executionTimeoutInMilliseconds.value > 0) {
                                promises.push(
                                    new Promise((resolve, reject) =>
                                        setTimeout(() => { if (executing) reject(new TimeoutError(this.properties.executionTimeoutInMilliseconds.value)); },
                                            this.properties.executionTimeoutInMilliseconds.value)
                                    )
                                );
                            }

                            result = await Promise.race(promises);
                            executing = false; // avoid timeout rejection
                        }
                        catch (e) {
                            // timeout
                            if (e instanceof TimeoutError) {
                                this.hystrixMetrics.markTimeout();
                                return await this.getFallbackOrThrowException(EventType.TIMEOUT, FailureType.TIMEOUT, "timed-out", e);
                            }
                            else // application error
                            {
                                return await this.onExecutionError(e);
                            }
                        }

                        // Execution complete correctly
                        this.hystrixMetrics.markSuccess();
                        this.hystrixMetrics.addExecutionTime(this.command.context.tracker.durationInMs);
                        this.circuitBreaker.markSuccess();
                        this.status.addEvent(EventType.SUCCESS);

                        // Update cache
                        // TODO
                        recordTotalTime = false;
                        return result;
                    }
                    finally {
                        this.semaphore.releaseExecutionCommand();
                    }
                }
                else {
                    this.hystrixMetrics.markRejected();
                    return await this.getFallbackOrThrowException(
                        EventType.SEMAPHORE_REJECTED,
                        FailureType.REJECTED_SEMAPHORE_EXECUTION,
                        "could not acquire a semaphore for execution",
                        new Error("could not acquire a semaphore for execution"));
                }
            }
            else // circuit breaker open
            {
                recordTotalTime = false;
                this.hystrixMetrics.markShortCircuited();
                return await this.getFallbackOrThrowException(
                    EventType.SHORT_CIRCUITED,
                    FailureType.SHORTCIRCUIT,
                    "short-circuited",
                    new Error(" circuit short-circuited and is OPEN"));
            }
        }
        finally {
            if (recordTotalTime) {
                this.recordTotalExecutionTime(this.command.context.tracker.durationInMs);
            }

            this.command.context.dispose();
            this.hystrixMetrics.decrementExecutionCount();
            this.status.isExecutionComplete = true;
        }
    }

    private async getFallbackOrThrowException(eventType: EventType, failureType: FailureType, message: string, error: Error): Promise<any> {
        this.command.context.logError(error);

        try {
            if (this.isUnrecoverable(error)) {
                this.logInfo(()=>"Unrecoverable error for command so will throw CommandRuntimeError and not apply fallback " + error);
                this.status.addEvent(eventType);
                throw new CommandRuntimeError(failureType, this.getCommandName(), this.getLogMessagePrefix() + " " + message + " and encountered unrecoverable error", error);
            }

            // Find fallback method
            // 1. <methodName>Fallback
            // 2. <methodName>FallbackAsync
            // 3. fallback
            // 4. fallbackAsync
            let fallbackName = this.handler.name;
            if (fallbackName.endsWith('Async'))
                fallbackName = fallbackName.substr(0, fallbackName.length - 5); // remove final async
            fallbackName += 'Fallback';
            let fallback = this.command[fallbackName];
            if (!fallback) {
                fallbackName += "Async";
                fallback = this.command[fallbackName + 'Async'];
            }
            if (!fallback) {
                fallbackName = "fallback";
                fallback = (<any>this.command).fallback;
            }
            if (!fallback) {
                fallbackName = "fallbackAsync";
                fallback = (<any>this.command).fallbackAsync;
            }
            if (!fallback) {
                //this.logInfo("No fallback for command");
                throw new CommandRuntimeError(failureType, this.getCommandName(), this.getLogMessagePrefix() + " " + message + " and no fallback provided.", error);
            }
            if (this.semaphore.canExecuteFallback()) {
                let oldContext = <RequestContext>this.command.context;
                this.command.context= oldContext.createCommandRequest(this.getCommandName() + "-" + fallbackName);
                try {
                    this.logInfo(()=>"Use fallback for command");
                    let result = await fallback.apply(this.command, this._arguments);
                    this.hystrixMetrics.markFallbackSuccess();
                    this.status.addEvent(EventType.FALLBACK_SUCCESS);
                    return result;
                }
                catch (e) {
                    this.command.context.logError(e);
                    this.logInfo(()=>"Fallback failed " + e);
                    this.hystrixMetrics.markFallbackFailure();
                    this.status.addEvent(EventType.FALLBACK_FAILURE);
                    throw new CommandRuntimeError(failureType, this.getCommandName(), this.getLogMessagePrefix() + " and fallback failed.", e);
                }
                finally {
                    this.semaphore.releaseFallback();
                    this.command.context.dispose();
                    this.command.context = oldContext;
                }
            }
            else {
                this.logInfo(()=>"Command fallback rejection.");
                this.hystrixMetrics.markFallbackRejection();
                this.status.addEvent(EventType.FALLBACK_REJECTION);
                throw new CommandRuntimeError(FailureType.REJECTED_SEMAPHORE_FALLBACK, this.getCommandName(), this.getLogMessagePrefix() + " fallback execution rejected.");
            }
        }
        catch (e) {
            this.hystrixMetrics.markExceptionThrown();
            throw e;
        }
    }

    private onExecutionError(e: Error): Promise<any> {
        e = e || new Error("Unknow error");

        if (e instanceof BadRequestError) {
            this.hystrixMetrics.markBadRequest(this.command.context.tracker.durationInMs);
            this.command.context.logError(e);
            throw e;
        }

       // this.logInfo(()=>`Error executing command ${e.stack} Proceeding to fallback logic...`);
        this.hystrixMetrics.markFailure();
        this.status.failedExecutionException = e;
        return this.getFallbackOrThrowException(EventType.FAILURE, FailureType.COMMAND_EXCEPTION, "failed", e);
    }

    private logInfo(msg: ()=> string) {
        this.command.context.logInfo(()=> this.getCommandName() + ": " + msg() );
    }

    private isUnrecoverable(e) {
        return false;
    }

    private getLogMessagePrefix() {
        return this.getCommandName();
    }

    private getCommandName() {
        return this.properties.commandName;
    }

    ///
    /// Record the duration of execution as response or exception is being returned to the caller.
    ///
    protected recordTotalExecutionTime(duration) {
        // the total execution time for the user thread including queuing, thread scheduling, run() execution
        this.hystrixMetrics.addExecutionTime(duration);

        /*
         * We record the executionTime for command execution.
         *
         * If the command is never executed (rejected, short-circuited, etc) then it will be left unset.
         *
         * For this metric we include failures and successes as we use it for per-request profiling and debugging
         * whereas 'metrics.addCommandExecutionTime(duration)' is used by stats across many requests.
         */
        this.status.executionTime = duration;
    }
}
