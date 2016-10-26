import RollingNumberEvent from "./rollingNumberEvent";

export default class PercentileBucket {
    private bucketValues: Array<number>;
    private pos: number = 0;
    public length: number = 0;
    public windowStart: number;

    constructor( private dataLength=100) {
        this.bucketValues = [];
    }

    addValue(value: number) {
        this.bucketValues[this.pos] = value;
        this.pos = (this.pos + 1) % this.dataLength; // roll over
        if( this.length < this.dataLength)
            this.length = this.length + 1;
    }

    get values() {
        if (this.length === 0)
            return null;    
        return this.length < this.dataLength ? this.bucketValues.slice(0, this.length) : this.bucketValues;
    }

    reset(windowStart: number) {
        this.windowStart = windowStart;
        this.pos = this.length = 0;
        this.bucketValues = [];
    }
}