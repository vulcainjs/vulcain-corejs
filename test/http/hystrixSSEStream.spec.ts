import { HystrixSSEStream } from "../../src/commands/http/hystrixSSEStream";
import { CommandFactory } from '../../src/commands/commandFactory';
import { CommandProperties } from "../../src/commands/commandProperties";
import { CommandMetricsFactory } from "../../src/commands/metrics/commandMetricsFactory";
import { AbstractCommand } from '../../src/commands/abstractCommand';
import { Command } from '../../src/commands/commandFactory';
import { TestContext } from '../../src/pipeline/testContext';

@Command()
export class HystrixSSECommand1 extends AbstractCommand<any> {
    runAsync(args) {
        this.setMetricsTags("verb", { test: "true" });
        return new Promise((resolve, reject) => {
            setTimeout(function () {
                resolve(args);
            }, 200);
        });
    }
}

let context = new TestContext();

describe("HystrixSSEStream", function () {

    function executeCommand(commandKey) {
        let command = CommandFactory.createDynamicCommand<HystrixSSECommand1>(context.context, commandKey);
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