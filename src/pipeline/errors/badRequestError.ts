import { ApplicationError } from './applicationRequestError';
// Error but not count as an exception in the metrics, has no incidence on circuit breaker
// and do not call getfallback
export class BadRequestError extends ApplicationError {
    constructor(message: string, errors?: { [propertyName: string]: string }) {
        super(message, 400, errors);
    }
}

