import { ApiKeyVerifyCommand } from "./apiKeyCommand";
import { Injectable, LifeTime, DefaultServiceNames, Inject } from '../../di/annotations';
import { ConfigurationProperty } from '../../globals/manifest';
import { IAuthenticationStrategy, UserContextData, UserToken } from "../securityContext";
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';
import { IDynamicProperty } from '../../configurations/abstractions';
import { Service } from '../../globals/system';
import { IRequestContext } from '../../pipeline/common';
import { UnauthorizedRequestError } from "../../pipeline/errors/applicationRequestError";
import { CommandFactory } from "../../commands/commandFactory";

// TODO add enableApiKeyAuthentication
@Injectable(LifeTime.Singleton, DefaultServiceNames.AuthenticationStrategy )
export class ApiKeyService implements IAuthenticationStrategy {

    public readonly name = "apiKey";
    private enabled: boolean;

    @ConfigurationProperty("apiKeyServiceName", "string") 
    private apiKeyServiceName: IDynamicProperty<string>;
    @ConfigurationProperty("apiKeyServiceVersion", "string")
    private apiKeyServiceVersion: IDynamicProperty<string>;

    constructor() {
        this.apiKeyServiceName = DynamicConfiguration.getChainedConfigurationProperty<string>("apiKeyServiceName");
        this.apiKeyServiceVersion = DynamicConfiguration.getChainedConfigurationProperty<string>("apiKeyServiceVersion");     
        this.enabled = !!this.apiKeyServiceName.value && !!this.apiKeyServiceVersion.value;
        if(this.enabled)
            Service.log.info(null, () => `using ${this.apiKeyServiceName.value}-${this.apiKeyServiceVersion.value} as ApiKey server`);
    }

    async verifyToken(ctx: IRequestContext, accessToken: string, tenant: string): Promise<UserToken> {
        if (!this.enabled)
            return null;
        
        if (!accessToken) {
            throw new UnauthorizedRequestError("You must provide a valid token");
        }

        // Can have an unique apikey define in vulcain.config (settings: { apiKey: { token: "", tenant: "", key }}) (for test)
        // with key = Buffer.from(JSON.stringify({name: "...", scopes: ["...", "..."] [, claims: {}, tenant: "", displayName: "", email: ""] }).toString('base64')
        let apiKey = Service.settings.getSettings("apiKey");
        let userContext;
        if (apiKey && apiKey.token === accessToken && tenant === tenant) {
            userContext = JSON.parse(Buffer.from(apiKey.key, "base64").toString('utf8'));
        }
        else {
            let cmd = CommandFactory.createDynamicCommand<ApiKeyVerifyCommand>(ctx, ApiKeyVerifyCommand.name);
            userContext = await cmd.run(this.apiKeyServiceName.value, this.apiKeyServiceVersion.value, { token: accessToken, tenant });
        }
        
        if (!userContext)
            throw new UnauthorizedRequestError("Invalid api key");

        userContext.scopes = Array.isArray(userContext.scopes) ? userContext.scopes : [<string>userContext.scopes];
        return userContext;
    }
}