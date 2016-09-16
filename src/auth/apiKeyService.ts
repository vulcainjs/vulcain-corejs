import { IContainer } from '../di/resolvers';
import { ITokenService } from '../defaults/services';
import {AbstractCommand} from '../commands/command/abstractCommand';
import {CommandFactory} from '../commands/command/commandFactory';
import {Command} from '../commands/command/commandFactory';

export class ApiKeyService implements ITokenService {
    constructor(private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
    }

    verifyTokenAsync(apiKey:string): Promise<boolean> {
        const cmd = CommandFactory.get(ApiKeyVerifyCommand.commandName);
        return cmd.executeAsync(this.apiKeyServiceName, this.apiKeyServiceVersion, apiKey );
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractCommand<boolean> {
    static commandName = "ApiKeyVerifyCommand";

    protected async runAsync(apiKeyServiceName:string, apiKeyServiceVersion: string, apiKey: string): Promise<any> {
        let resp = await this.sendActionAsync<boolean>(apiKeyServiceName, apiKeyServiceVersion, "verifyToken", { apiKey: apiKey });
        return !resp.error && resp.value;
    }
}