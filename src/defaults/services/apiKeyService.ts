import { VerifyTokenParameter } from './../../defaults/services';
import { ITokenService } from '../../defaults/services';
import { CommandFactory, Command } from '../../commands/command/commandFactory';
import { AbstractServiceCommand } from './../../commands/command/abstractServiceCommand';
import { AbstractHandler } from '../../pipeline/abstractHandlers';
import { IContainer } from '../../di/resolvers';
import { UserContext } from '../../servers/requestContext';
import { DefaultServiceNames, Inject } from '../../di/annotations';

export class ApiKeyService extends AbstractHandler implements ITokenService {
    constructor(@Inject(DefaultServiceNames.Container) container: IContainer, private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
        super(container);
    }

    createTokenAsync(user: UserContext): Promise<{ expiresIn: number, token: string, renewToken: string }> {
        return Promise.reject("Invalid method. You must use vulcain-authentication module to create token.");
    }

    async verifyTokenAsync(data: VerifyTokenParameter): Promise<boolean> {
        const cmd = await CommandFactory.getAsync(ApiKeyVerifyCommand.commandName, this.requestContext);
        return await cmd.runAsync<boolean>(this.apiKeyServiceName, this.apiKeyServiceVersion, data);
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractServiceCommand {
    static commandName = "ApiKeyVerifyCommand";

    protected initializeMetricsInfo() {
    }

    async runAsync(apiKeyServiceName: string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<any> {
        let resp = await this.sendActionAsync<boolean>(apiKeyServiceName, apiKeyServiceVersion, "apikey.verifyToken", data);
        return !resp.error && resp.value;
    }
}