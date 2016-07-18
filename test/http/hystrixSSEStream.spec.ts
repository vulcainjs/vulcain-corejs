import {HystrixSSEStream} from "../../dist/commands/http/HystrixSSEStream";
import {CommandFactory} from '../../dist/commands/command/commandFactory'
import {CommandProperties} from "../../dist/commands/command/commandProperties";
import {CommandMetrics, CommandMetricsFactory} from "../../dist/commands/metrics/commandMetrics";
import {AbstractCommand} from '../../dist/commands/command/abstractCommand'
import {Command} from '../../dist/commands/command/commandFactory'

@Command()
export class HystrixSSECommand1 extends AbstractCommand<any> {
    runAsync(args) {
        return new Promise((resolve, reject) => {
            setTimeout(function () {
                resolve(args);
            }, 200)
        });
    }
}

describe("HystrixSSEStream", function() {

    function executeCommand(commandKey) {
        var command = CommandFactory.get(commandKey);
        command.executeAsync("success");
    }

    it("should poll metrics every second", function(done) {
        executeCommand("HystrixSSECommand1");
        executeCommand("HystrixSSECommand1");

        setTimeout(function() {
            executeCommand("HystrixSSECommand1");
            var stream = HystrixSSEStream.toObservable(500);
            var subscription = stream.subscribe(
                function(next) {
                    subscription.dispose();
                    done();
                }
            );
        }, 1001);
    });
});