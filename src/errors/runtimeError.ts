import { ApplicationRequestError } from './applicationRequestError';
export class RuntimeError extends ApplicationRequestError {
    constructor(message: string) {
        super(message);
    }
}
