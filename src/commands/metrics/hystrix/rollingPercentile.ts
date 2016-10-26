import ActualTime from "../../../utils/actualTime";
import Bucket from "./percentileBucket";
import {Stats} from 'fast-stats';

export class RollingPercentile {

    private windowLength: number;
    private numberOfBuckets: number;
    private buckets;
    private percentileSnapshot: PercentileSnapshot;
    private currentBucketIndex = 0;

    constructor(timeInMillisecond: number, numberOfBuckets: number) {
        if (timeInMillisecond <= 0 || numberOfBuckets <= 0)
            throw new Error("Invalid arguments for RollingPercentile. Must be > 0.");
        this.windowLength = timeInMillisecond;
        this.numberOfBuckets = numberOfBuckets;
        this.buckets = [];
        this.percentileSnapshot = new PercentileSnapshot();

        // Pre initialize buckets
        for (let i = 0; i < numberOfBuckets; i++) {
            this.buckets[i] = new Bucket();
        }
        this.buckets[0].windowStart = ActualTime.getCurrentTime();
    }

    get bucketSizeInMilliseconds() {
        return this.windowLength / this.numberOfBuckets;
    }

    addValue(value) {
        this.getCurrentBucket().addValue(value)
    }

    getPercentile(percentile) {
        this.getCurrentBucket();
        return this.percentileSnapshot.getPercentile(percentile);
    }

    getCurrentBucket() {
        let currentTime = ActualTime.getCurrentTime();
        let currentBucket = this.buckets[this.currentBucketIndex];
        if (currentTime < (currentBucket.windowStart + this.bucketSizeInMilliseconds)) {
            return currentBucket;
        }

        this.currentBucketIndex = (this.currentBucketIndex + 1) % this.numberOfBuckets;
        currentBucket = this.buckets[this.currentBucketIndex];
        currentBucket.reset(currentTime);
        this.percentileSnapshot = new PercentileSnapshot(this.buckets);
        return currentBucket;
    }

    getLength() {
        let length=0;
        for (let bucket of this.buckets) {
            let values = bucket.values;
            if(values)
                length++;
        }
        return length;
    }
}

class PercentileSnapshot {
    private stats: Stats;
    private mean;
    private p0 :number;
    private p5 :number;
    private p10:number;
    private p25:number;
    private p50:number;
    private p75:number;
    private p90:number;
    private p95:number;
    private p99:number;
    private p995: number;
    private p999: number;
    private p100: number;

    constructor(allBuckets = []) {
        this.stats = new Stats();
        for (let bucket of allBuckets) {
            let values = bucket.values;
            if(values)
                this.stats.push(values)
        }

        this.mean = this.stats.amean() || 0;
        this.p0 = this.stats.percentile(0) || 0;
        this.p5 = this.stats.percentile(5) || 0;
        this.p10 = this.stats.percentile(10) || 0;
        this.p25 = this.stats.percentile(25) || 0;
        this.p50 = this.stats.percentile(50) || 0;
        this.p75 = this.stats.percentile(75) || 0;
        this.p90 = this.stats.percentile(90) || 0;
        this.p95 = this.stats.percentile(95) || 0;
        this.p99 = this.stats.percentile(99) || 0;
        this.p995 = this.stats.percentile(99.5) || 0;
        this.p999 = this.stats.percentile(99.9) || 0;
        this.p100 = this.stats.percentile(100) || 0;

    }

    getPercentile(percentile: number | string = "mean") {
        if (percentile === "mean") {
            return this.mean;
        }

        switch (percentile) {
            case 0: return this.p0;
            case 5: return this.p5;
            case 10: return this.p10;
            case 25: return this.p25;
            case 50: return this.p50;
            case 75: return this.p75;
            case 90: return this.p90;
            case 95: return this.p95;
            case 99: return this.p99;
            case 99.5: return this.p995;
            case 99.9: return this.p999;
            case 100: return this.p100;
        }
    }
}