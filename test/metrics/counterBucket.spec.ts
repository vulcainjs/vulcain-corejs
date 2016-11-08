import Bucket from "../../dist/commands/metrics/hystrix/counterBucket";
import RollingNumberEvent from "../../dist/commands/metrics/hystrix/rollingNumberEvent";
import { expect } from 'chai';

describe("CounterBucket", function () {
    var underTest;

    beforeEach(function () {
        underTest = new Bucket();
    });

    it("should increment value for a valid event", function () {
        underTest.increment(RollingNumberEvent.SUCCESS);
        expect(underTest.get(RollingNumberEvent.SUCCESS)).to.equal(1);
        underTest.increment(RollingNumberEvent.SUCCESS);
        expect(underTest.get(RollingNumberEvent.SUCCESS)).to.equal(2);
    });

    it("should return 0, if event was not recorded yet", function () {
        expect(underTest.get(RollingNumberEvent.FAILURE)).to.equal(0);
    });

    it("should throw exception, if an invalid event is passed", function () {
        expect(function () { underTest.get("invalid"); }).to.throw(Error);
        expect(function () { underTest.increment("invalid"); }).to.throw(Error);
    });
});