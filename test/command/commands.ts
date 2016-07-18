import {AbstractCommand} from '../../dist/commands/command/abstractCommand'
import {Command} from '../../dist/commands/command/commandFactory'

@Command()
export class TestCommand extends AbstractCommand<any> {
    runAsync(args) {
        return Promise.resolve(args);
    }
}

@Command({executionTimeoutInMilliseconds:100})
export class TestCommandTimeout extends AbstractCommand<any> {
    runAsync(args) {
        return new Promise((resolve, reject) => { setTimeout(resolve, 300); });
    }
}

@Command({executionTimeoutInMilliseconds:100})
export class TestCommandFallback extends AbstractCommand<any> {
    runAsync(args) {
            return new Promise((resolve, reject) => {
                throw new Error("rejected")
            });
    }

    fallbackAsync(args) {
        return Promise.resolve("fallback");
    }
}

@Command({executionTimeoutInMilliseconds:100, circuitBreakerForceOpened:true})
export class TestCommandCircuitOpen extends AbstractCommand<any> {
    runAsync(args) {
        return Promise.resolve(args);
    }

    fallbackAsync(args) {
        return Promise.resolve("fallback");
    }
}