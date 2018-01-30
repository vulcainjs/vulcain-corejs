import { AbstractCommand } from '../../src/commands/abstractCommand';
import { Command } from '../../src/commands/commandFactory';
import { DynamicConfiguration } from '../../src/configurations/dynamicConfiguration';
import { CommandFactory } from '../../src/commands/commandFactory';

DynamicConfiguration.reset();
CommandFactory.reset();

@Command()
export class TestCommand extends AbstractCommand<any> {
    foo(args:string) {
        this.setMetricsTags("verb", {"test":"true"});
        return Promise.resolve<string>(args);
    }
}

@Command({ executionTimeoutInMilliseconds: 100 })
export class TestCommandTimeout extends AbstractCommand<any> {
    runAsync(args) {
        this.setMetricsTags("verb", {"test":"true"});
        return new Promise((resolve, reject) => { setTimeout(resolve, 300); });
    }
}

@Command({ executionTimeoutInMilliseconds: 100 })
export class TestCommandFallback extends AbstractCommand<any> {
    runAsync(args) {
        this.setMetricsTags("verb", {"test":"true"});
        return new Promise((resolve, reject) => {
            throw new Error("rejected");
        });
    }

    fallbackAsync(args) {
        return Promise.resolve("fallback");
    }
}

@Command({ executionTimeoutInMilliseconds: 100, circuitBreakerForceOpened: true })
export class TestCommandCircuitOpen extends AbstractCommand<any> {
    runAsync(args) {
        this.setMetricsTags("verb", {test:"true"});
        return Promise.resolve(args);
    }

    fallbackAsync(args) {
        return Promise.resolve("fallback");
    }
}