import {CircuitBreakerFactory} from "../../dist/commands/command/circuitBreaker";
import {CommandFactory} from '../../dist/commands/command/commandFactory'
import {CommandProperties} from "../../dist/commands/command/commandProperties";
import {CommandMetrics, CommandMetricsFactory} from "../../dist/commands/metrics/commandMetrics";
import {DynamicConfiguration} from 'vulcain-configurationsjs'
import { expect } from 'chai';
import * as sinon from 'sinon';
import {TimeoutError, CommandRuntimeError} from '../../dist/commands/command/command'
import {AbstractCommand} from '../../dist/commands/command/abstractCommand'

class MyCommand extends AbstractCommand<any> {
    runAsync(args) {
        return Promise.resolve(args);
    }

    testCreateUrl() {
        return this.createUrl("http://localhost:80", "p", "a", "t", "h", { field: "test" });
    }
}

describe("AbstractCommand", function() {
    it("should create a valid url", function() {

        var command = new MyCommand(null, null);
        expect(command.testCreateUrl()).to.be.equal("http://localhost:80/p/a/t/h?field=test");
    });


});