import {CircuitBreakerFactory} from "../../dist/commands/command/circuitBreaker";
import {CommandFactory} from '../../dist/commands/command/commandFactory'
import {CommandProperties} from "../../dist/commands/command/commandProperties";
import {CommandMetrics, CommandMetricsFactory} from "../../dist/commands/metrics/commandMetrics";
import {DynamicConfiguration} from '@sovinty/vulcain-configurations'
import { expect } from 'chai';
import * as sinon from 'sinon';
import {TimeoutError, CommandRuntimeError} from '../../dist/commands/command/command'
import {AbstractCommand} from '../../dist/commands/command/abstractCommand'

class MyCommand extends AbstractCommand<any> {
    runAsync(args) {
        return Promise.resolve(args);
    }

    testCreateUrl(...urlSegments) {
        return this.createUrl("http://localhost:80", Array.from(urlSegments));
    }
}

describe("AbstractCommand", function() {
    it("should create a valid url", function() {

        var command = new MyCommand(null);
        expect(command.testCreateUrl("p", "a", "t", "h", { field: "test" })).to.be.equal("http://localhost:80/p/a/t/h?field=test");
    });


});