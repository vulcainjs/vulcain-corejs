import ActualTime from "../../utils/actualTime";
import Bucket from "./counterBucket";

export class RollingNumber {
    private windowLength: number;
    private numberOfBuckets: number;
    private buckets;
    private currentBucketIndex = 0;
    private bucketsLength: number;
    public bucketSizeInMilliseconds:number;

    constructor(timeInMillisecond: number, numberOfBuckets: number) {
        if (timeInMillisecond <= 0 || numberOfBuckets <= 0)
            throw new Error("Invalid arguments for RollingNumber. Must be > 0.");

        this.windowLength = timeInMillisecond;
        this.numberOfBuckets = numberOfBuckets;
        this.bucketSizeInMilliseconds = this.windowLength / this.numberOfBuckets;

        this.buckets = [];
        // Pre initialize buckets
        for (let i = 0; i < numberOfBuckets; i++) {
            this.buckets[i] = new Bucket();
        }
        this.buckets[0].reset(ActualTime.getCurrentTime());
        this.bucketsLength = 1;
    }

    get length() {
        return this.bucketsLength;
    }

    increment(type) {
        this.getCurrentBucket().increment(type);
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
        if (this.bucketsLength < this.numberOfBuckets)
            this.bucketsLength++;

        return currentBucket;
    }

    getRollingSum(type) {
        this.getCurrentBucket();
        let startingWindowTime = ActualTime.getCurrentTime() - this.windowLength;
        let sum = 0;
        for (let i = 0; i < this.bucketsLength; i++) {
            if( this.buckets[i].windowStart >= startingWindowTime)
                sum += this.buckets[i].get(type);
        }
        return sum;
    }

    reset() {
        for (let i = 0; i < this.bucketsLength; i++) {
            this.buckets[i].reset();
        }
        this.currentBucketIndex = 0;
        this.bucketsLength = 1;
    }
}
