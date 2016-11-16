import { Injectable, LifeTime, DefaultServiceNames, Inject } from '../../di/annotations';
import { ITokenService, VerifyTokenParameter } from '../services';
import { UserContext } from '../../servers/requestContext';
import { Conventions } from '../../utils/conventions';
const jwt = require('jsonwebtoken');
const ms = require('ms');

@Injectable(LifeTime.Singleton, DefaultServiceNames.TokenService)
export class TokenService implements ITokenService {

    private issuer: string;
    // https://github.com/auth0/node-jsonwebtoken
    private secretKey: string;
    // https://github.com/rauchg/ms.js
    private tokenExpiration: string;

    constructor() {
        this.issuer = process.env[Conventions.instance.ENV_TOKEN_ISSUER];
        this.tokenExpiration = process.env[Conventions.instance.ENV_TOKEN_EXPIRATION] || Conventions.instance.defaultTokenExpiration;
        this.secretKey = process.env[Conventions.instance.ENV_VULCAIN_SECRET_KEY] || Conventions.instance.defaultSecretKey;
    }

    createTokenAsync( user: UserContext ): Promise<string> {

        return new Promise(async (resolve, reject) => {
            const payload = {
                value:
                {
                    user: {
                        displayName: user.displayName,
                        id: user.id,
                        email: user.email,
                        name: user.name,
                        tenant: user.tenant
                    },
                    scopes: user.scopes
                }
            };

            let options = { issuer: this.issuer || "vulcain", expiresIn: this.tokenExpiration };

            try {
                let jwtToken = this.createToken(payload, options);
                let renewToken = this.createToken({}, options);

                let expiresIn;
                if (typeof this.tokenExpiration === 'string') {
                    const milliseconds = ms(this.tokenExpiration);
                    expiresIn = Math.floor(milliseconds / 1000);
                }
                else {
                    expiresIn = this.tokenExpiration;
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
        token = jwt.sign(payload, this.secretKey, options);
        return token;
    }

    verifyTokenAsync(p: VerifyTokenParameter): Promise<any> {
        return new Promise(async (resolve, reject) => {
            if (!p.token) {
                reject("You must provided a valid token");
                return;
            }
            let options: any = { "issuer": this.issuer || "vulcain" };

            try {
                let key = this.secretKey;
                //options.algorithms=[ALGORITHM];

                jwt.verify(p.token, key, options, (err, payload) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        const token = payload.value;
                        if (token.user.tenant !== p.tenant) {
                            reject({ message: "Invalid tenant" });
                        }
                        else {
                            resolve(token);
                        }
                    }
                });
            }
            catch (err) {
                reject({ error: err, message: "Invalid JWT token" });
            }
        });
    }
}
