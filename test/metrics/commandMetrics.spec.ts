import RollingNumberEvent from "../../dist/commands/metrics/hystrix/rollingNumberEvent";
import { CommandMetricsFactory } from "../../dist/commands/metrics/commandMetricsFactory";
import { CommandProperties } from "../../dist/commands/commandProperties";
import { expect } from 'chai';
import ActualTime from "../../dist/utils/actualTime";
import { HystrixCommandMetrics } from '../../dist/commands/metrics/hystrix/hystrixCommandMetrics';

describe("CommandMetrics", function () {

    let underTest;
    let props = new CommandProperties("TestCommandMetrics", "defaultGroup", <any>{});

    beforeEach(function () {
        ActualTime.enableVirtualTimer();
        underTest = new HystrixCommandMetrics(props);
    });

    it("should increment success counter on markSuccess calls", function () {
        underTest.markSuccess();
        expect(underTest.getRollingCount(RollingNumberEvent.SUCCESS)).to.equal(1);
        underTest.markSuccess();
        underTest.markSuccess();
        expect(underTest.getRollingCount(RollingNumberEvent.SUCCESS)).to.equal(3);
    });

    it("should increment failure counter on markFailure calls", function () {
        underTest.markFailure();
        expect(underTest.getRollingCount(RollingNumberEvent.FAILURE)).to.equal(1);
        underTest.markFailure();
        underTest.markFailure();
        expect(underTest.getRollingCount(RollingNumberEvent.FAILURE)).to.equal(3);
    });

    it("should increment timeout counter on markTimeout calls", function () {
        underTest.markTimeout();
        expect(underTest.getRollingCount(RollingNumberEvent.TIMEOUT)).to.equal(1);
        underTest.markTimeout();
        underTest.markTimeout();
        expect(underTest.getRollingCount(RollingNumberEvent.TIMEOUT)).to.equal(3);
    });

    it("should increment rejected counter on markRejected calls", function () {
        underTest.markRejected();
        expect(underTest.getRollingCount(RollingNumberEvent.REJECTED)).to.equal(1);
        underTest.markRejected();
        underTest.markRejected();
        expect(underTest.getRollingCount(RollingNumberEvent.REJECTED)).to.equal(3);
    });

    it("should increment short circuited counter on markShortCircuited calls", function () {
        underTest.markShortCircuited();
        expect(underTest.getRollingCount(RollingNumberEvent.SHORT_CIRCUITED)).to.equal(1);
        underTest.markShortCircuited();
        underTest.markShortCircuited();
        expect(underTest.getRollingCount(RollingNumberEvent.SHORT_CIRCUITED)).to.equal(3);
    });

    it("should return the sum of all buckets in the window", function () {
        underTest.markTimeout();
        underTest.markTimeout();
        underTest.markTimeout();
        ActualTime.fastForwardActualTime(2000);
        underTest.markTimeout();
        expect(underTest.getRollingCount(RollingNumberEvent.TIMEOUT)).to.equal(4);
    });

    it("should return a correct execution time percentile", function () {
        underTest.addExecutionTime(1);
        underTest.addExecutionTime(11);
        ActualTime.fastForwardActualTime(20000);
        expect(underTest.getExecutionTime(100)).to.equal(11);
        expect(underTest.getExecutionTime("mean")).to.equal(6);
    });

    it("should return 0 values as health counts initially", function () {
        expect(underTest.getHealthCounts().totalCount).to.equal(0);
        expect(underTest.getHealthCounts().errorCount).to.equal(0);
        expect(underTest.getHealthCounts().errorPercentage).to.equal(0);
    });

    it("should return correct values as health counts", function () {

        underTest.markSuccess();
        underTest.markSuccess();
        underTest.markSuccess();

        underTest.markFailure();
        underTest.markFailure();
        underTest.markShortCircuited();
        underTest.markTimeout();
        underTest.markRejected();

        expect(underTest.getHealthCounts().totalCount).to.equal(8);
        expect(underTest.getHealthCounts().errorCount).to.equal(5);
        expect(underTest.getHealthCounts().errorPercentage).to.equal(62.5);
    });

    it("should throw an error if no key is provided", function () {
        expect(function () {
            new HystrixCommandMetrics(null);
        }).to.throw();
    });
});