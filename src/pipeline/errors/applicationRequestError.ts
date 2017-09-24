
/**
 *
 *
 * @export
 * @class ApplicationError
 * @extends {Error}
 */

import { ValidationError } from "./validationError";

export class ApplicationError extends Error {
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
export class UnauthorizedRequestError extends ApplicationError {
    constructor(msg = "Unauthorized") {
        super(msg, 401);
    }
}

/**
 *
 */
export class ForbiddenRequestError extends ApplicationError {
    constructor(msg = "Forbidden") {
        super(msg, 403);
    }
}

export class NotFoundError extends ApplicationError {
    constructor(msg = "Not found") {
        super(msg, 404);
    }
}