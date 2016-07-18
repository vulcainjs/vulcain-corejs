import RollingNumberEvent from "./rollingNumberEvent";

export default class CounterBucket {
    private bucketValues;
    public windowStart: number;
    
    constructor () {
        this.bucketValues = {};
    }

    reset(windowsStart: number) {
        this.windowStart = windowsStart;
        this.bucketValues = {};
    }    

    get(type) {
        if (RollingNumberEvent[type] === undefined) {
            throw new Error("invalid event");
        }

        if (!this.bucketValues[type]) {
            return 0;
        }
        return this.bucketValues[type];
    }

    increment(type) {
        if (RollingNumberEvent[type] === undefined) {
            throw new Error("invalid event");
        }

        let value = this.bucketValues[type];
        if (value) {
            value = value + 1;
            this.bucketValues[type] = value;
        } else {
            this.bucketValues[type] = 1;
        }
    }
}