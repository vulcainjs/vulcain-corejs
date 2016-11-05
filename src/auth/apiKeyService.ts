import { VerifyTokenParameter } from './../defaults/services';
import { ITokenService } from '../defaults/services';
import { CommandFactory } from '../commands/command/commandFactory';
import { Command } from '../commands/command/commandFactory';
import { AbstractServiceCommand } from './../commands/command/abstractServiceCommand';

export class ApiKeyService implements ITokenService {
    constructor(private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
    }

    async verifyTokenAsync(data: VerifyTokenParameter): Promise<boolean> {
        const cmd = await CommandFactory.getAsync(ApiKeyVerifyCommand.commandName);
        return await cmd.executeAsync<boolean>(this.apiKeyServiceName, this.apiKeyServiceVersion, data);
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractServiceCommand {
    static commandName = "ApiKeyVerifyCommand";

    protected initializeMetricsInfo() {
    }

    async runAsync(apiKeyServiceName: string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<any> {
        this.metrics.setTags("targetServiceName=" + apiKeyServiceName, "targetServiceVersion=" + apiKeyServiceVersion);
        let resp = await this.sendActionAsync<boolean>(apiKeyServiceName, apiKeyServiceVersion, "verifyToken", data);
        return !resp.error && resp.value;
    }
}