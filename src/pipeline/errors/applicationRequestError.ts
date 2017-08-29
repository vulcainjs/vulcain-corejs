
/**
 *
 *
 * @export
 * @class ApplicationRequestError
 * @extends {Error}
 */

import { ValidationError } from "./validationError";

export class ApplicationRequestError extends Error {
    /**
     *
     *
     * @private
     * @type {Array<ValidationError>}
     */
    public errors: Array<ValidationError>;

    /**
     * Creates an instance of ApplicationRequestError.
     *
     * @param {ErrorResponse} error
     */
    constructor(public message: string, public statusCode = 500, errors?: Array<ValidationError>) {
        super();
        this.errors = errors;
    }
}

/**
 * Fordidden error
 *
 * @export
 * @class ForbiddenRequestError
 * @extends {ApplicationRequestError}
 */
export class UnauthorizedRequestError extends ApplicationRequestError {
    constructor(msg = "Unauthorized") {
        super(msg, 401);
    }
}

/**
 * 
 */
export class ForbiddenRequestError extends ApplicationRequestError {
    constructor(msg = "Forbidden") {
        super(msg, 403);
    }
}

export class NotFoundError extends ApplicationRequestError {
    constructor(msg = "Not found") {
        super(msg, 404);
    }
}