
/**
 *
 *
 * @export
 * @class ApplicationError
 * @extends {Error}
 */
export class ApplicationError extends Error {
    public errors: {[propertyName: string]: string}|undefined;
    public messageTitle?: string;

    /**
     * Creates an instance of ApplicationRequestError.
     *
     * @param {ErrorResponse} error
     */
    constructor(public message: string, public statusCode = 500, errors?: { [propertyName: string]: string }) {
        super();
        this.errors = errors;
        this.messageTitle = message;
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