import { ValidationError } from './../pipeline/common';

/**
 *
 *
 * @export
 * @class ApplicationRequestError
 * @extends {Error}
 */
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
    constructor(message: string, errors?: Array<ValidationError>, public statusCode=200) {
        super(message);
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
export class ForbiddenRequestError extends ApplicationRequestError {
    constructor(msg = "Forbidden") {
        super(msg, null, 403);
    }
}