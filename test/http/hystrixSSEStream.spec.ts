import { HystrixSSEStream } from "../../dist/commands/http/hystrixSSEStream";
import { CommandFactory } from '../../dist/commands/command/commandFactory';
import { CommandProperties } from "../../dist/commands/command/commandProperties";
import { CommandMetricsFactory } from "../../dist/commands/metrics/commandMetricsFactory";
import { AbstractCommand } from '../../dist/commands/command/abstractCommand';
import { Command } from '../../dist/commands/command/commandFactory';
import { TestContext } from '../../dist/di/testContext';

@Command()
export class HystrixSSECommand1 extends AbstractCommand<any> {
    runAsync(args) {
        this.setMetricsTags({ test: "true" });
        return new Promise((resolve, reject) => {
            setTimeout(function () {
                resolve(args);
            }, 200);
        });
    }
}

let context = new TestContext();

describe("HystrixSSEStream", function () {

    async function executeCommand(commandKey) {
        let command = await CommandFactory.getAsync(commandKey, context.requestContext);
        command.runAsync("success");
    }

    it("should poll metrics every second", function (done) {
        executeCommand("HystrixSSECommand1");
        executeCommand("HystrixSSECommand1");

        setTimeout(function () {
            executeCommand("HystrixSSECommand1");
            let stream = HystrixSSEStream.toObservable(500);
            let subscription = stream.subscribe(
                function (next) {
                    subscription.unsubscribe();
                    done();
                }
            );
        }, 1001);
    });
});