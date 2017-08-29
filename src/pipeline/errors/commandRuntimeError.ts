import { FailureType } from '../../commands/executionResult';

export class CommandRuntimeError extends Error {
    constructor(public failureType: FailureType, public commandName: string, message: string, public error?) {
        super(message);
    }
}
