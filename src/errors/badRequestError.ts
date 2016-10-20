// Error but not count as an exception in the metrics, has no incidence on circuit breaker
// and do not call getfallback
export class BadRequestError extends Error {
    constructor(message: string, public errors?:Array<any>) {
        super(message);
    }
}

