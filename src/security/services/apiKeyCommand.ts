import { Property } from '../../schemas/builder/annotations.property';
import { InputModel } from '../../schemas/builder/annotations.model';
import { Command } from "../../commands/commandFactory";
import { AbstractServiceCommand } from "../../commands/abstractServiceCommand";
import { UserToken } from '../securityContext';

@InputModel()
export class VerifyTokenParameter {
    @Property({ type: "string", required: true })
    token: string;
    @Property({ type: "string" })
    tenant: string;
}

@Command({ executionTimeoutInMilliseconds: 500 })
export class ApiKeyVerifyCommand extends AbstractServiceCommand {
    static commandName = "ApiKeyVerifyCommand";

    async run(apiKeyServiceName: string, apiKeyServiceVersion: string, data: VerifyTokenParameter): Promise<UserToken> {
        let resp = await this.execAction<UserToken>(apiKeyServiceName, apiKeyServiceVersion, this.context, "apikey.verifyToken", data);
        return resp && resp.value;
    }
}