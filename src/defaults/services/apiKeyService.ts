import { VerifyTokenParameter } from './../../defaults/services';
import { ITokenService } from '../../defaults/services';
import { CommandFactory } from '../../commands/command/commandFactory';
import { Command } from '../../commands/command/commandFactory';
import { AbstractServiceCommand } from './../../commands/command/abstractServiceCommand';
import { AbstractHandler } from '../../pipeline/abstractHandlers';
import { IContainer } from '../../di/resolvers';
import { UserContext } from '../../servers/requestContext';

export class ApiKeyService extends AbstractHandler implements ITokenService {
    constructor(container: IContainer, private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
        super(container);
    }

    createTokenAsync(user: UserContext): Promise<string> {
        return Promise.reject<string>("Invalid method. You must use vulcain-authentication module to create token.");
    }

    async verifyTokenAsync(data: VerifyTokenParameter): Promise<boolean> {
        const cmd = await CommandFactory.getAsync(ApiKeyVerifyCommand.commandName, this.requestContext);
        return await cmd.executeAsync<boolean>(this.apiKeyServiceName, this.apiKeyServiceVersion, data);
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractServiceCommand {
    static commandName = "ApiKeyVerifyCommand";

    protected initializeMetricsInfo() {
    }

    async runAsync(apiKeyServiceName: string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<any> {
        this.setMetricsTags("targetServiceName=" + apiKeyServiceName, "targetServiceVersion=" + apiKeyServiceVersion);
        let resp = await this.sendActionAsync<boolean>(apiKeyServiceName, apiKeyServiceVersion, "verifyToken", data);
        return !resp.error && resp.value;
    }
}