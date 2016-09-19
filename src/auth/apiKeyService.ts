import { VerifyTokenParameter } from './../defaults/services';
import { IContainer } from '../di/resolvers';
import { ITokenService } from '../defaults/services';
import {AbstractCommand} from '../commands/command/abstractCommand';
import {CommandFactory} from '../commands/command/commandFactory';
import {Command} from '../commands/command/commandFactory';

export class ApiKeyService implements ITokenService {
    constructor(private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
    }

    verifyTokenAsync(data:VerifyTokenParameter): Promise<boolean> {
        const cmd = CommandFactory.get(ApiKeyVerifyCommand.commandName);
        return cmd.executeAsync(this.apiKeyServiceName, this.apiKeyServiceVersion, data );
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractCommand<boolean> {
    static commandName = "ApiKeyVerifyCommand";

    protected async runAsync(apiKeyServiceName:string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<any> {
        let resp = await this.sendActionAsync<boolean>(apiKeyServiceName, apiKeyServiceVersion, "verifyToken", data);
        return !resp.error && resp.value;
    }
}