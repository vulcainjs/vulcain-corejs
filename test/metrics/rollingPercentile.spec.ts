import { RollingPercentile } from "../../src/commands/metrics/hystrix/rollingPercentile";
import { expect } from 'chai';
import ActualTime from '../../src/utils/actualTime';

function addExecutionTimes(rollingPercentile) {
    rollingPercentile.addValue(1);
    rollingPercentile.addValue(2);
    rollingPercentile.addValue(3);
    rollingPercentile.addValue(10);
    rollingPercentile.addValue(8);
    rollingPercentile.addValue(4);
    rollingPercentile.addValue(3);
}

describe("RollingPercentile", function () {
    it("should return 0 values before the first roll", function () {
        let underTest = new RollingPercentile(10000, 10);
        addExecutionTimes(underTest);
        expect(underTest.getPercentile("mean")).to.equal(0);
        expect(underTest.getPercentile(0)).to.equal(0);
        expect(underTest.getPercentile(50)).to.equal(0);

    }
    );

    it("should roll the last bucket", function () {
        ActualTime.enableVirtualTimer();
        try {
            let underTest = new RollingPercentile(10000, 10);
            underTest.addValue(1);
            ActualTime.fastForwardActualTime(1500);
            underTest.addValue(2);
            expect(underTest.getLength()).to.equal(2);
        }
        finally {
            ActualTime.restore();
        }
    }
    );

    it("should calculate correct percentile after the first window roll", function () {
        ActualTime.enableVirtualTimer();
        try {
            let underTest = new RollingPercentile(10000, 10);
            addExecutionTimes(underTest);
            ActualTime.fastForwardActualTime(1001);
            expect(underTest.getPercentile("mean").toFixed(2)).to.equal("4.43");
            expect(underTest.getPercentile(0).toFixed(2)).to.equal("1.00");
            expect(underTest.getPercentile(50).toFixed(2)).to.equal("3.00");
        }
        finally {
            ActualTime.restore();
        }
    }
    );

    it("should consider values values from all buckets", function () {
        ActualTime.enableVirtualTimer();
        try {
            let underTest = new RollingPercentile(10000, 10);
            addExecutionTimes(underTest);
            ActualTime.fastForwardActualTime(1001);
            underTest.addValue(10);
            underTest.addValue(923);
            ActualTime.fastForwardActualTime(1001);
            expect(underTest.getPercentile("mean").toFixed(2)).to.equal("107.11");
            expect(underTest.getPercentile(0).toFixed(2)).to.equal("1.00");
            expect(underTest.getPercentile(50).toFixed(2)).to.equal("4.00");
        }
        finally {
            ActualTime.restore();
        }
    }
    );
});