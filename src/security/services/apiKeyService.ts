import { DefaultServiceNames, Inject } from '../../di/annotations';
import { AbstractHandler } from "../../pipeline/handlers/abstractHandlers";
import { IAuthenticationStrategy, UserContext, UserToken } from "../securityContext";
import { IContainer } from "../../di/resolvers";
import { Command, CommandFactory } from "../../commands/commandFactory";
import { AbstractServiceCommand } from "../../commands/abstractServiceCommand";
/*
export class ApiKeyService extends AbstractHandler implements IAuthenticationStrategy {
    constructor(@Inject(DefaultServiceNames.Container) container: IContainer, private apiKeyServiceName: string, private apiKeyServiceVersion: string) {
        super(container);
    }

    createToken(user: UserContext): Promise<{ expiresIn: number, token: string, renewToken: string }> {
        return Promise.reject("Invalid method. You must use vulcain-authentication module to create token.");
    }

    async verifyToken(data: VerifyTokenParameter): Promise<UserToken> {
        const cmd = CommandFactory.get<ApiKeyVerifyCommand>(ApiKeyVerifyCommand.commandName, this.context);
        return await cmd.run(this.apiKeyServiceName, this.apiKeyServiceVersion, data);
    }
}

@Command({ executionTimeoutInMilliseconds: 500 })
class ApiKeyVerifyCommand extends AbstractServiceCommand {
    static commandName = "ApiKeyVerifyCommand";

    async run(apiKeyServiceName: string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<UserToken> {
        let resp = await this.sendAction<boolean>(apiKeyServiceName, apiKeyServiceVersion, "apikey.verifyToken", data);
        return resp.value;
    }
}*/