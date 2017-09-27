import { Injectable, LifeTime, DefaultServiceNames, Inject } from '../../di/annotations';
import { Conventions } from '../../utils/conventions';
import { System } from '../../globals/system';
import { IDynamicProperty } from '../../configurations/abstractions';
import { ConfigurationProperty } from '../../dependencies/annotations';
import { ITokenService, UserContext, VerifyTokenParameter, UserToken } from "../securityManager";

const jwt = require('jsonwebtoken');
const jwks = require('jwks-rsa');
const ms = require('ms');
const unirest = require('unirest');

export class StsTokenService implements ITokenService {

    @ConfigurationProperty(Conventions.instance.TOKEN_STS_AUTHORITY, "string")
    private authority: IDynamicProperty<string>;
    private readonly openidConfig: string = '/.well-known/openid-configuration';
    private jwksConfig = {
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: ms('8h'),
        strictssl: false, // TODO: test env to enforce ssl in production
        jwksUri: undefined
    };
    private signingKey: string;
    private jwksClient: { getSigningKey(kid: string, callback: (err: Error, key: { publicKey: string, rsaPublicKey: string}) => void) };

    constructor() {
        this.authority = System.createChainedConfigurationProperty<string>(Conventions.instance.TOKEN_STS_AUTHORITY, 'http://localhost:5100');
        System.log.info(null, () => `using ${this.authority.value} as STS authority`);
        this.initializeRsaSigninKey();
    }

    private ensureInitialized(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.jwksClient) {
                resolve(true);
            } else {
                this.initializeRsaSigninKey().then(_ => resolve(true), rej => reject(rej));
            }
        });
    }

    private initializeRsaSigninKey(): Promise<string> {
        return new Promise((resolve, reject) => {
            const openIdConfigUrl = `${this.authority.value}/.well-known/openid-configuration`;
            // TODO command
            const oidcConfig = unirest.get(openIdConfigUrl).as.json((res) => {
                if (res.error) {
                    reject(res.error);
                } else if (res.status >= 400) {
                    reject(res);
                } else {
                    this.jwksConfig.jwksUri = res.body.jwks_uri;
                    this.jwksClient = jwks(this.jwksConfig);
                    resolve(this.jwksConfig.jwksUri);
                }
            });
        });
    }

    // token is created by STS so don't need this method
    createTokenAsync( user: UserContext ): Promise<{ expiresIn: number, token: string, renewToken: string }> {

        return new Promise(async (resolve, reject) => {
            const err: Error = {
                message: "Service is setup to work with an STS so can't create token",
                name: "token-creation-error",
                stack: null
            };

            reject({ error: err, message: "Error when creating new token for user :" + user.name + " - " + (err.message || err) });
        });
    }

    verifyTokenAsync(p: VerifyTokenParameter): Promise<UserToken> {
        return new Promise(async (resolve, reject) => {
            if (!p.token) {
                reject("You must provide a valid token");
                return;
            }
            let options: any = {
                "issuer": [ this.authority.value ],
                // "audience": "patient-highlights" //TODO: get service name as defined in STS resource manager
            };

            const decodedToken = jwt.decode(p.token, { complete: true });

            this.ensureInitialized().then(() => {
                this.jwksClient.getSigningKey(decodedToken.header.kid, (err, key) => {
                    if (err) {
                        reject({ error: err, message: `Unable to resolve RSA public key from kid: ${decodedToken.header.kid}` });
                        return;
                    }
                    const signingKey = key.publicKey || key.rsaPublicKey;

                    jwt.verify(p.token, signingKey, options, (err, decodedToken) => {
                        if (err) {
                            reject({ error: err, message: "Invalid JWT token" });
                        } else {
                            resolve(decodedToken);
                        }
                    });
                });
            })
            .catch(reject);

        });
    }
}