import RollingNumberEvent from "../../dist/commands/metrics/hystrix/rollingNumberEvent";
import { RollingNumber } from "../../dist/commands/metrics/hystrix/rollingNumber";
import { expect } from 'chai';
import ActualTime from '../../dist/utils/actualTime';

describe("RollingNumber", function () {

    beforeEach(function () {
        ActualTime.enableVirtualTimer();
    });

    it("should be initialised with option values", function () {
        var underTest = new RollingNumber(5000, 5);
        expect((<any>underTest).windowLength).to.equal(5000);
        expect((<any>underTest).numberOfBuckets).to.equal(5);
    });

    it("should increment a value in the latest bucket", function () {
        var underTest = new RollingNumber(60000, 5);
        var lastBucket = underTest.getCurrentBucket();
        underTest.increment(RollingNumberEvent.SUCCESS);
        underTest.increment(RollingNumberEvent.SUCCESS);
        expect(lastBucket.get(RollingNumberEvent.SUCCESS)).to.equal(2);
    });

    it("should roll the last bucket", function () {
        ActualTime.enableVirtualTimer();
        try {
            var underTest = new RollingNumber(10000, 10);

            underTest.increment(RollingNumberEvent.SUCCESS);
            ActualTime.fastForwardActualTime(1001);

            underTest.increment(RollingNumberEvent.SUCCESS);
            expect(underTest.length).to.equal(2);
        }
        finally {
            ActualTime.restore();
        }
    });

    it("should reset the window if no activity was reported for the period longer than the window itself", function () {
        ActualTime.enableVirtualTimer();
        try {
            var underTest = new RollingNumber(1000, 2);
            underTest.increment(RollingNumberEvent.SUCCESS);
            ActualTime.fastForwardActualTime(501);
            underTest.increment(RollingNumberEvent.SUCCESS);
            expect(underTest.length).to.equal(2);
            expect(underTest.getRollingSum(RollingNumberEvent.SUCCESS)).to.equal(2);
            ActualTime.fastForwardActualTime(1002);

            underTest.increment(RollingNumberEvent.SUCCESS);
            expect(underTest.getRollingSum(RollingNumberEvent.SUCCESS)).to.equal(1);
        }
        finally {
            ActualTime.restore();
        }
    });

    it("should return the sum of the values from all buckets", function () {
        ActualTime.enableVirtualTimer();
        try {
            var underTest = new RollingNumber(10000, 10);

            underTest.increment(RollingNumberEvent.SUCCESS);

            ActualTime.fastForwardActualTime(1500);
            underTest.increment(RollingNumberEvent.SUCCESS);
            underTest.increment(RollingNumberEvent.SUCCESS);
            underTest.increment(RollingNumberEvent.SUCCESS);
            expect(underTest.length).to.equal(2);
            expect(underTest.getRollingSum(RollingNumberEvent.SUCCESS)).to.equal(4);
        }
        finally {
            ActualTime.restore();
        }
    });
});