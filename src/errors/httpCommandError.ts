import { ApplicationRequestError } from './applicationRequestError';
import { IHttpCommandResponse } from '../commands/command/types';

export class HttpCommandError extends ApplicationRequestError {
    response: IHttpCommandResponse;
    error: Error;

    constructor(msg, response: IHttpCommandResponse | Error, statusCode?: number) {
        super(msg);
        if(!response) {
            return;
        }

        if (response instanceof Error) {
            this.error = response;
            this.statusCode = statusCode || 500;
        }
        else {
            this.response = response;
            this.statusCode = statusCode || response.status;
        }
    }
}