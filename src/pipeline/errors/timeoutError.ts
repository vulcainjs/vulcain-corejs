import { ApplicationError } from "./applicationRequestError";

export class TimeoutError extends ApplicationError {
    constructor(ms:number) {
        super("Timeout error - Command take more than " + ms + "ms");
    }
}
