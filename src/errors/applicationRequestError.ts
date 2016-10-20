import { ErrorResponse } from './../pipeline/common';
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
    private errors: Array<ValidationError>;

    /**
     * Creates an instance of ApplicationRequestError.
     *
     * @param {ErrorResponse} error
     */
    constructor(error: ErrorResponse, public statusCode=500) {
        super((error && error.message) || "Unknow error");
        this.errors = error && error.errors;
    }
}
