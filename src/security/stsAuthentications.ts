import { SecurityManager, ITokenService } from "./securityManager";
import { ConfigurationProperty } from "../dependencies/annotations";
import { Conventions } from "../utils/conventions";
import { IDynamicProperty } from "../configurations/abstractions";
import { Inject, DefaultServiceNames } from "../di/annotations";
import { IAuthorizationPolicy } from "./authorizationPolicy";
import { System } from "../globals/system";
import { RequestContext } from "../pipeline/requestContext";

const unirest = require('unirest');

export class StsAuthentication extends SecurityManager {

    @ConfigurationProperty(Conventions.instance.TOKEN_STS_AUTHORITY, "string")
    private authority: IDynamicProperty<string>;
    private userInfoEndpoint: string;

    constructor( @Inject(DefaultServiceNames.AuthorizationPolicy) scopePolicy: IAuthorizationPolicy) {
        super(scopePolicy);
        this.authority = System.createChainedConfigurationProperty<string>(Conventions.instance.TOKEN_STS_AUTHORITY, 'http://localhost:5100');
        System.log.info(null, () => `using ${this.authority.value} as STS authority`);

        this.addOrReplaceStrategy('bearer', this.verify.bind(this));
    }

    private ensureUserInfoEndpointLoaded() {
        return new Promise<boolean>((resolve, reject) => {
            if (this.userInfoEndpoint) {
                resolve(true);
            } else {
                const openIdConfigUrl = `${this.authority.value}/.well-known/openid-configuration`;
                unirest.get(openIdConfigUrl).as.json(res => {
                    if (res.error) {
                        reject(res.error);
                    } else if (res.status >= 400) {
                        reject(res);
                    } else {
                        this.userInfoEndpoint = res.body.userinfo_endpoint;
                        resolve(true);
                    }
                });
            }
        });
    }

    private async getUserInfoAsync(accessToken: string) {
        await this.ensureUserInfoEndpointLoaded()
            .catch(err => {
                System.log.error(null, err, () => 'Error getting STS user info endpoint');
            });

        return new Promise<any>((resolve, reject) => {
            unirest.get(this.userInfoEndpoint).headers({ authorization: `Bearer ${accessToken}` }).as.json(res => {
                if (res.status >= 400) {
                    reject(res);
                } else {
                    resolve(res.body);
                }
            });

        });
    }

    private async verify(ctx: RequestContext, accessToken: string) {
        try {
            let tokens = ctx.container.get<ITokenService>(DefaultServiceNames.TokenService);
            let token: any = await tokens.verifyTokenAsync({ token: accessToken, tenant: ctx.user.tenant });

            // No token found
            if (!token) {
                System.log.info(ctx, () => "Bearer authentication: Invalid jwtToken : " + accessToken);
                return null;
            }

            // get user info from STS
            let user = await this.getUserInfoAsync(accessToken);
            user.scopes = [
                ...token.scope,
                ...token.role
            ];

            System.log.info(ctx, () => JSON.stringify(user));

            return user; // Return the current user with its scopes and tenant
        }
        catch (err) {
            System.log.error(ctx, err, () => "Bearer authentication: Error with jwtToken " + accessToken);
            return null;
        }
    }
}