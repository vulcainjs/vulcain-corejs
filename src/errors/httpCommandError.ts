import { ApplicationRequestError } from './applicationRequestError';
import { IHttpResponse } from '../commands/command/types';

export class HttpCommandError extends ApplicationRequestError {
    response: IHttpResponse;
    error: Error;

    constructor(msg, response: IHttpResponse | Error, statusCode?: number) {
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