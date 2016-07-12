import {Command} from '../../pipeline/commands';
import {CommandHandler, Action} from '../../pipeline/annotations';
import {ValidationError, RuntimeError} from '../../pipeline/common';
import {Property, Model} from '../../schemas/annotations'
import {ITokenService} from '../services';
import {Inject} from '../../di/annotations';
import {IProvider} from '../../providers/provider';
import {Domain} from '../../schemas/schema';
import {User} from '../models/user';
import * as fs from 'fs';
var jwt = require('jsonwebtoken');

@CommandHandler({ async:false, scope:"?",  serviceName:"TokenService"})
export class TokenHandler implements ITokenService {

    private issuer:string;
    // https://github.com/auth0/node-jsonwebtoken
    // Certificate file (SHA 256)
    private privateKey:Buffer;
    private secretKey:string;
    // https://github.com/rauchg/ms.js
    private tokenExpiration:string;

    constructor(
        @Inject( "Domain" ) domain,
        @Inject( "UserProvider", true ) private _users:IProvider<User>
    )
    {
        this.issuer= process.env["VULCAIN_TOKEN_ISSUER"];
        this.tokenExpiration= process.env["VULCAIN_TOKEN_EXPIRATION"] || "20m";
        this.secretKey = process.env["VULCAIN_SECRET_KEY"] || "DnQBnCG7*fjEX@Rw5uN^hWR4*AkRVKMeRu2#Ucu^ECUNWrKr";
        let privateKeyPath = process.env["VULCAIN_PRIVATE_KEY_PATH"];
        if(privateKeyPath && fs.exists( privateKeyPath ))
        {
            this.privateKey = fs.readFileSync( privateKeyPath );
        }
    }
/*
  async renewTokenAsync(renewToken) : Promise<string>
    {
        let user = await this._users.findOneAsync( {name:ctx.user.name} );
        // No user found with that username
        if( !user || user.disabled)
        {
            throw {code:401, body: {message:"User is disabled"} };
        }

        let token = await this.verifyTokenAsync(renewToken);
        if(!token)
            throw new Error("Invalid renew token");

        let result = await this.createTokenAsync();
        return result;
    }

    private createTokenAsync( ctx:RequestContext ) : Promise<string>
    {
        return new Promise( async ( resolve, reject ) =>
        {
            const payload = {
                value :
                    {
                        user:{
                            displayName:ctx.user.displayName,
                            id:ctx.user.id,
                            email:ctx.user.email,
                            name: ctx.user.name
                        },
                        scopes: ctx.user.scopes
                    }
            };

            let options = {issuer:this.issuer, expiresIn: this.tokenExpiration, algorithm: ALGORITHM};

            try
            {
                let jwtToken = this.createToken(payload, options);
                let renewToken = this.createToken({}, options);

                let expiresIn;
                if (typeof this.tokenExpiration === 'string') {
                    const milliseconds = ms(this.tokenExpiration);
                    expiresIn = Math.floor(milliseconds / 1000);
                }
                else
                {
                    expiresIn = this.tokenExpiration
                }
                resolve( {token:jwtToken, userId: ctx.user.id, userName:ctx.user.displayName, renewToken:renewToken, scopes:ctx.user.scopes, createdDate:moment.utc().format(), "expires_in": expiresIn} );
            }
            catch(err)
            {
                reject({error:err, message:"Error when creating new token for user :" + ctx.user.name + " - " + (err.message || err)});
            }
        } );
    }
*/
    @Action()
    private createToken(payload, options)
    {
        let token;
        token = jwt.sign( payload, this.privateKey || this.secretKey, options );
        return token;
    }

    verifyTokenAsync( jwtToken ) : Promise<any>
    {
        return new Promise( async ( resolve, reject ) =>
        {
            if(!jwtToken)
            {
                reject("You must provided a valid token");
                return;
            }
            let options:any = {"issuer":this.issuer};

            try
            {
                let key = this.privateKey || this.secretKey;
                //options.algorithms=[ALGORITHM];

                jwt.verify( jwtToken, key, options, (err, payload) =>
                {
                    if(err)
                        reject(err);
                    else
                        resolve(payload.value);
                });
            }
            catch(err)
            {
                reject({error:err, message:"Invalid JWT token"});
            }
        } );
    }
}