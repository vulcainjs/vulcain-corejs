import {CircuitBreakerFactory} from "../../dist/commands/command/circuitBreaker";
import {CommandFactory} from '../../dist/commands/command/commandFactory'
import {CommandProperties} from "../../dist/commands/command/commandProperties";
import {CommandMetrics, CommandMetricsFactory} from "../../dist/commands/metrics/commandMetrics";
import { expect } from 'chai';
import * as sinon from 'sinon';
import {TimeoutError, CommandRuntimeError} from '../../dist/commands/command/command'
import './commands'

describe("Command", function() {
    it("should resolve with expected results", function(done) {

        var command = CommandFactory.get("TestCommand");
        expect(command).not.to.be.undefined;

        command.executeAsync<string>("success").then(function(result) {
            expect(result).to.be.equal("success");
            var metrics = CommandMetricsFactory.get("TestCommand");
            expect(metrics.getHealthCounts().totalCount).to.be.equal(1);
            expect(metrics.getHealthCounts().errorCount).to.be.equal(0);
            done();
        })
    });

    it("should timeout if the function does not resolve within the configured timeout", function (done) {

        var command = CommandFactory.get("TestCommandTimeout");

        expect(command).not.to.be.undefined;
        command.executeAsync("success")
            .then(function () {
                expect.fail();
                done();
            })
            .catch(function (err) {
                expect(err).to.be.instanceOf(CommandRuntimeError); // no fallback

                var metrics = CommandMetricsFactory.get("TestCommandTimeout");
                expect(metrics.getHealthCounts().totalCount).to.be.equal(1);
                expect(metrics.getHealthCounts().errorCount).to.be.equal(1);
                done();
            }
            );
    });

    it("should resolve with fallback if the run function fails", function(done) {

        var command = CommandFactory.get("TestCommandFallback");

        command.executeAsync("success").then(function(result) {
            expect(result).to.be.equal("fallback");
            var metrics = CommandMetricsFactory.get("TestCommandFallback");
            expect(metrics.getHealthCounts().totalCount).to.be.equal(1);
            expect(metrics.getHealthCounts().errorCount).to.be.equal(1);
            done();
        })
    });

    it("should not execute the run command, if the circuit is open", function (done) {
        try {
            var command = CommandFactory.get("TestCommandCircuitOpen");
            var spy = sinon.spy((<any>command).command, "runAsync");

            var metrics = CommandMetricsFactory.get("TestCommandCircuitOpen");
            command.executeAsync("success").then(function (result) {
                expect(result).to.be.equal("fallback");
                expect(spy.notCalled);
                done();
            });
        }
        catch (e) {
            console.log(e);
            done();
        }
    });

 /*   it("should execute the run command, if the circuit volume threshold is not reached", function(done) {
        var object = {
            run:function() {
                 return new Promise((resolve, reject) => {
                    reject(new Error("error"));
                });
            }
        };

        spyOn(object, "run").and.callThrough();
        var command = CommandFactory.get("TestCommandThresholdNotReached")
            .run(object.run)
            .fallbackTo(function(err) {
                return q.resolve("fallback");
            })
            .circuitBreakerErrorThresholdPercentage(10)
            .circuitBreakerRequestVolumeThreshold(3)
            .build();

            var metrics = CommandMetricsFactory.get("TestCommandThresholdNotReached");
        metrics.incrementExecutionCount();
        metrics.markFailure();
        metrics.markFailure();
        command.executeAsync().then(function(result) {
            expect(result).to.be.equal("fallback");
            expect(object.run).toHaveBeenCalled();
            done();
        });
    });

    it("should return fallback and not mark failure, if the command failed but with expected error", function() {

        var command = CommandFactory.get("TestCommandErrorHandler")
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

            var metrics = CommandMetricsFactory.get("TestCommandErrorHandler");
        command.executeAsync().then(function(result) {
            expect(result).to.be.equal("fallback");
            var errorCount = metrics.getHealthCounts().errorCount;
            expect(errorCount).to.be.equal(0);
            done();
        });
    });

    it("should reject request immediately, if the request volume threshold is reached", function(done) {
        var run = function(arg) {
            return q.Promise(function(resolve, reject, notify) {
                resolve(arg);
            });
        };

        var command = CommandFactory.get("VolumeThresholdCommand")
            .run(run)
            .requestVolumeRejectionThreshold(2)
            .build();

            var metrics = CommandMetricsFactory.get("VolumeThresholdCommand");
        metrics.incrementExecutionCount();
        metrics.incrementExecutionCount();
        command.executeAsync("success").then(failTest(done)).fail(function(error) {
            expect(error.message).to.be.equal("CommandRejected");
            expect(metrics.getRollingCount(RollingNumberEvent.REJECTED)).to.be.equal(1);
            done();
        });
    });

    it("should execute fallback, if the request volume threshold is reached", function(done) {
        var object = {
            run:function() {
                 return new Promise((resolve, reject) => {
                    reject(new Error("error"));
                });
            }
        };

        spyOn(object, "run").and.callThrough();
        var command = CommandFactory.get("VolumeThresholdCommandFallback")
            .run(object.run)
            .fallbackTo(function(err) {
                return q.resolve("fallback");
            })
            .requestVolumeRejectionThreshold(2)
            .build();

            var metrics = CommandMetricsFactory.get("VolumeThresholdCommandFallback");
        metrics.incrementExecutionCount();
        metrics.incrementExecutionCount();
        command.executeAsync("success").then(function(result) {
            expect(result).to.be.equal("fallback");
            expect(metrics.getRollingCount(RollingNumberEvent.REJECTED)).to.be.equal(1);
            expect(object.run).not.toHaveBeenCalled();
            done();
        }).fail(failTest(done));
    })*/
});