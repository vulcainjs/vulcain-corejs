import { CommandProperties } from '../command/commandProperties';
import { HystrixCommandMetrics } from './hystrix/hystrixCommandMetrics';

export interface ICommandMetrics {
    incrementExecutionCount();
    markTimeout();
    markSuccess();
    addExecutionTime(duration: number);
    markRejected();
    markShortCircuited();
    decrementExecutionCount();
    markFallbackSuccess();
    markFallbackFailure();
    markFallbackRejection();
    markExceptionThrown();
    markFailure();
    markBadRequest(duration: number);
}

export class CommandMetricsFactory {
    private static metricsByCommand = new Map<string, ICommandMetrics>();

    static getOrCreate(options:CommandProperties): ICommandMetrics {
        let previouslyCached = CommandMetricsFactory.metricsByCommand.get(options.commandName);
        if (previouslyCached) {
            return previouslyCached
        }

        let metrics = new HystrixCommandMetrics(options);

        CommandMetricsFactory.metricsByCommand.set(options.commandName, metrics);
        return metrics;

    }

    static get(commandName:string): ICommandMetrics {
        return CommandMetricsFactory.metricsByCommand.get(commandName);
    }

    static resetCache() {
        CommandMetricsFactory.metricsByCommand.clear();
    }

    static getAllMetrics() {
        return CommandMetricsFactory.metricsByCommand.values();
    }
}
