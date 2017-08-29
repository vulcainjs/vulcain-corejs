export class TimeoutError extends Error {
    constructor(ms:number) {
        super("Timeout error - Command take more than " + ms + "ms");
    }
}
