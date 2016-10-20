import { FailureType } from './../commands/command/executionResult';

export class CommandRuntimeError extends Error {
    constructor(public failureType: FailureType, public commandName: string, message: string, public error?) {
        super(message);
    }
}
