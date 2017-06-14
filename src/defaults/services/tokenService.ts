import { Injectable, LifeTime, DefaultServiceNames, Inject } from '../../di/annotations';
import { ITokenService, VerifyTokenParameter } from '../services';
import { UserContext } from '../../servers/requestContext';
import { Conventions } from '../../utils/conventions';
import { System } from '../../configurations/globals/system';
import { IDynamicProperty } from '../../configurations/dynamicProperty';
import { ConfigurationProperty } from '../../configurations/dependencies/annotations';
const jwt = require('jsonwebtoken');
const ms = require('ms');

@ConfigurationProperty(Conventions.instance.TOKEN_ISSUER, "string")
@ConfigurationProperty(Conventions.instance.TOKEN_EXPIRATION, "string")
@ConfigurationProperty(Conventions.instance.VULCAIN_SECRET_KEY, "string")
export class TokenService implements ITokenService {

    private issuer: IDynamicProperty<string>;
    private secretKey: IDynamicProperty<string>;
    private tokenExpiration: IDynamicProperty<string>;

    constructor() {
        this.issuer = System.createSharedConfigurationProperty<string>( Conventions.instance.TOKEN_ISSUER );
        this.tokenExpiration = System.createSharedConfigurationProperty<string>(Conventions.instance.TOKEN_EXPIRATION, Conventions.instance.defaultTokenExpiration);
        this.secretKey = System.createSharedConfigurationProperty<string>(Conventions.instance.VULCAIN_SECRET_KEY, Conventions.instance.defaultSecretKey);
    }

    createTokenAsync( user: UserContext ): Promise<string> {

        return new Promise(async (resolve, reject) => {
            const payload = {
                value:
                {
                    user: {
                        displayName: user.displayName,
                        email: user.email,
                        name: user.name,
                        tenant: user.tenant
                    },
                    scopes: user.scopes
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

    verifyTokenAsync(p: VerifyTokenParameter): Promise<any> {
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
