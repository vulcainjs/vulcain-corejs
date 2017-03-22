import { CircuitBreakerFactory } from "../../dist/commands/command/circuitBreaker";
import { CommandFactory } from '../../dist/commands/command/commandFactory';
import { CommandProperties } from "../../dist/commands/command/commandProperties";
import { ICommandMetrics, CommandMetricsFactory } from "../../dist/commands/metrics/commandMetricsFactory";
import { expect } from 'chai';
import * as sinon from 'sinon';
import './commands';
import { CommandRuntimeError } from '../../dist/errors/commandRuntimeError';
import { HystrixCommandMetrics } from '../../dist/commands/metrics/hystrix/hystrixCommandMetrics';
import { TestContainer } from '../../dist/di/containers';

let container = new TestContainer("Test");

describe("Command", function () {
    it("should resolve with expected results", async () => {
        let command = await CommandFactory.getAsync("TestCommand", container.scope.requestContext);
        expect(command).not.to.be.undefined;

        let result = await command.runAsync<string>("success");
        expect(result).to.be.equal("success");
        let metrics = CommandMetricsFactory.get("TestCommand");
        expect((<HystrixCommandMetrics>metrics).getHealthCounts().totalCount).to.be.equal(1);
        expect((<HystrixCommandMetrics>metrics).getHealthCounts().errorCount).to.be.equal(0);
    });

    it("should timeout if the function does not resolve within the configured timeout", async () => {
        let command = await CommandFactory.getAsync("TestCommandTimeout", container.scope.requestContext);

        expect(command).not.to.be.undefined;
        try {
            await command.runAsync("success");
            expect.fail();
        }
        catch (err) {
            expect(err).to.be.instanceOf(CommandRuntimeError); // no fallback

            let metrics = CommandMetricsFactory.get("TestCommandTimeout");
            expect((<HystrixCommandMetrics>metrics).getHealthCounts().totalCount).to.be.equal(1);
            expect((<HystrixCommandMetrics>metrics).getHealthCounts().errorCount).to.be.equal(1);
        }
    });

    it("should resolve with fallback if the run function fails", async () => {
        let command = await CommandFactory.getAsync("TestCommandFallback", container.scope.requestContext);

        let result = await command.runAsync("success");
        expect(result).to.be.equal("fallback");
        let metrics = CommandMetricsFactory.get("TestCommandFallback");
        expect((<HystrixCommandMetrics>metrics).getHealthCounts().totalCount).to.be.equal(1);
        expect((<HystrixCommandMetrics>metrics).getHealthCounts().errorCount).to.be.equal(1);
    });

    it("should not execute the run command, if the circuit is open", async () => {
        let command = await CommandFactory.getAsync("TestCommandCircuitOpen", container.scope.requestContext);
        let spy = sinon.spy((<any>command).command, "runAsync");

        let metrics = CommandMetricsFactory.get("TestCommandCircuitOpen");
        let result = await command.runAsync("success");
        expect(result).to.be.equal("fallback");
        expect(spy.notCalled);
    });

    /*   it("should execute the run command, if the circuit volume threshold is not reached", function(done) {
           let object = {
               run:function() {
                    return new Promise((resolve, reject) => {
                       reject(new Error("error"));
                   });
               }
           };

           spyOn(object, "run").and.callThrough();
           let command = CommandFactory.get("TestCommandThresholdNotReached")
               .run(object.run)
               .fallbackTo(function(err) {
                   return q.resolve("fallback");
               })
               .circuitBreakerErrorThresholdPercentage(10)
               .circuitBreakerRequestVolumeThreshold(3)
               .build();

               let metrics = CommandMetricsFactory.get("TestCommandThresholdNotReached");
           metrics.incrementExecutionCount();
           metrics.markFailure();
           metrics.markFailure();
           command.runAsync().then(function(result) {
               expect(result).to.be.equal("fallback");
               expect(object.run).toHaveBeenCalled();
               done();
           });
       });

       it("should return fallback and not mark failure, if the command failed but with expected error", function() {

           let command = CommandFactory.get("TestCommandErrorHandler")
               .run(function() {
                    return new Promise((resolve, reject) => {
                       reject(new Error("custom-error"));
                   });
               })
               .errorHandler(function(error) {
                   if (error.message == "custom-error") {
                       return false;
                   }
                   return error;
               })
               .fallbackTo(function(err) {
                   return q.resolve("fallback");
               })
               .circuitBreakerErrorThresholdPercentage(10)
               .circuitBreakerRequestVolumeThreshold(0)
               .build();

               let metrics = CommandMetricsFactory.get("TestCommandErrorHandler");
           command.runAsync().then(function(result) {
               expect(result).to.be.equal("fallback");
               let errorCount = metrics.getHealthCounts().errorCount;
               expect(errorCount).to.be.equal(0);
               done();
           });
       });

       it("should reject request immediately, if the request volume threshold is reached", function(done) {
           let run = function(arg) {
               return q.Promise(function(resolve, reject, notify) {
                   resolve(arg);
               });
           };

           let command = CommandFactory.get("VolumeThresholdCommand")
               .run(run)
               .requestVolumeRejectionThreshold(2)
               .build();

               let metrics = CommandMetricsFactory.get("VolumeThresholdCommand");
           metrics.incrementExecutionCount();
           metrics.incrementExecutionCount();
           command.runAsync("success").then(failTest(done)).fail(function(error) {
               expect(error.message).to.be.equal("CommandRejected");
               expect(metrics.getRollingCount(RollingNumberEvent.REJECTED)).to.be.equal(1);
               done();
           });
       });

       it("should execute fallback, if the request volume threshold is reached", function(done) {
           let object = {
               run:function() {
                    return new Promise((resolve, reject) => {
                       reject(new Error("error"));
                   });
               }
           };

           spyOn(object, "run").and.callThrough();
           let command = CommandFactory.get("VolumeThresholdCommandFallback")
               .run(object.run)
               .fallbackTo(function(err) {
                   return q.resolve("fallback");
               })
               .requestVolumeRejectionThreshold(2)
               .build();

               let metrics = CommandMetricsFactory.get("VolumeThresholdCommandFallback");
           metrics.incrementExecutionCount();
           metrics.incrementExecutionCount();
           command.runAsync("success").then(function(result) {
               expect(result).to.be.equal("fallback");
               expect(metrics.getRollingCount(RollingNumberEvent.REJECTED)).to.be.equal(1);
               expect(object.run).not.toHaveBeenCalled();
               done();
           }).fail(failTest(done));
       })*/
});