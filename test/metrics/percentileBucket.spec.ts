import Bucket from "../../src/commands/metrics/hystrix/percentileBucket";
import RollingNumberEvent from "../../src/commands/metrics/hystrix/rollingNumberEvent";
import { expect } from 'chai';

describe("PercentileBucket", function () {
    let underTest;

    beforeEach(function () {
        underTest = new Bucket(5000);
    });

    it("should add value to the bucket values", function () {
        underTest.addValue(1);
        expect(underTest.values).not.to.be.undefined;
        underTest.addValue(1);
        expect(underTest.values.length).to.equal(2);
    });
});