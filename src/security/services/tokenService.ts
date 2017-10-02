import { Injectable, LifeTime, DefaultServiceNames, Inject } from '../../di/annotations';
import { Conventions } from '../../utils/conventions';
import { System } from '../../globals/system';
import { IDynamicProperty } from '../../configurations/abstractions';
import { ConfigurationProperty } from '../../dependencies/annotations';
import { ITokenService, UserContext, VerifyTokenParameter, UserToken } from "../securityManager";
const jwt = require('jsonwebtoken');
const ms = require('ms');
import { DynamicConfiguration } from '../../configurations/dynamicConfiguration';

export class TokenService implements ITokenService {

    @ConfigurationProperty(Conventions.instance.TOKEN_ISSUER, "string")
    private issuer: IDynamicProperty<string>;
    @ConfigurationProperty(Conventions.instance.VULCAIN_SECRET_KEY, "string")
    private secretKey: IDynamicProperty<string>;
    @ConfigurationProperty(Conventions.instance.TOKEN_EXPIRATION, "string")
    private tokenExpiration: IDynamicProperty<string>;

    constructor() {
        this.issuer = DynamicConfiguration.getChainedConfigurationProperty<string>( Conventions.instance.TOKEN_ISSUER );
        this.tokenExpiration = DynamicConfiguration.getChainedConfigurationProperty<string>(Conventions.instance.TOKEN_EXPIRATION, Conventions.instance.defaultTokenExpiration);
        this.secretKey = DynamicConfiguration.getChainedConfigurationProperty<string>(Conventions.instance.VULCAIN_SECRET_KEY, Conventions.instance.defaultSecretKey);
    }

    createTokenAsync( user: UserContext ): Promise<{ expiresIn: number, token: string, renewToken: string }> {

        return new Promise(async (resolve, reject) => {
            const payload = {
                value:
                {
                    displayName: user.displayName,
                    email: user.email,
                    name: user.name,
                    tenant: user.tenant,
                    scopes: user.scopes,
                    claims: user.claims
                }
            };

            let options = { issuer: this.issuer.value, expiresIn: this.tokenExpiration.value };

            try {
                let jwtToken = this.createToken(payload, options);
                let renewToken = this.createToken({}, options);

                let expiresIn;
                if (typeof this.tokenExpiration.value === 'string') {
                    const milliseconds = ms(this.tokenExpiration.value);
                    expiresIn = Math.floor(milliseconds / 1000);
                }
                else {
                    expiresIn = this.tokenExpiration.value;
                }
                // token payload contains iat (absolute expiration date in sec)
                resolve({ expiresIn, token: jwtToken, renewToken: renewToken });
            }
            catch (err) {
                reject({ error: err, message: "Error when creating new token for user :" + user.name + " - " + (err.message || err) });
            }
        });
    }

    private createToken(payload, options) {
        let token;
        token = jwt.sign(payload, this.secretKey.value, options);
        return token;
    }

    verifyTokenAsync(p: VerifyTokenParameter): Promise<UserToken> {
        return new Promise(async (resolve, reject) => {
            if (!p.token) {
                reject("You must provide a valid token");
                return;
            }
            let options: any = { "issuer": this.issuer.value };

            try {
                let key = this.secretKey.value;
                //options.algorithms=[ALGORITHM];

                jwt.verify(p.token, key, options, (err, payload) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        const token = payload.value;
                        resolve(token);
                    }
                });
            }
            catch (err) {
                reject({ error: err, message: "Invalid JWT token" });
            }
        });
    }
}