import { ApplicationRequestError } from './applicationRequestError';
import { ValidationError } from "./validationError";
// Error but not count as an exception in the metrics, has no incidence on circuit breaker
// and do not call getfallback
export class BadRequestError extends ApplicationRequestError {
    constructor(message: string, errors?:Array<ValidationError>) {
        super(message, 400, errors);
    }
}

