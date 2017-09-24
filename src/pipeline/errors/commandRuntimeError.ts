import { FailureType } from '../../commands/executionResult';
import { ApplicationError } from './applicationRequestError';

export class CommandRuntimeError extends ApplicationError {
    constructor(public failureType: FailureType, public commandName: string, message: string, public error?) {
        super(message);
    }
}
