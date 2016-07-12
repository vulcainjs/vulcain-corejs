import {Command} from '../../pipeline/commands';
import {CommandHandler, Action} from '../../pipeline/annotations';
import {ValidationError, RuntimeError} from '../../pipeline/common';
import {Property, Model} from '../../schemas/annotations'
import {IApiKeyService} from '../services';
import {Inject} from '../../di/annotations';
import {IProvider} from '../../providers/provider';
import {Domain} from '../../schemas/schema';

@Model("ApiKey",{ storageName: "tokens"} )
export class ApiKey
{
    @Property({type:"string", required:false, isKey:true})
    token:string;
    @Property({type:"arrayOf", item:"string", required: true})
    scopes:Array<string>;
    @Property({type:"string", required: true})
    description:string;
    @Property({type:"string", required: true})
    userId: string;
    @Property({type:"string", required: true})
    userName: string;
}

@CommandHandler({async:false, scope:"?",  schema:"ApiKey", serviceName:"ApiKeyService"})
export class ApiHandler implements IApiKeyService {

    constructor(
        @Inject( "Domain" ) domain:Domain,
        @Inject( "Provider" ) private _provider:IProvider<ApiKey>
    )
    {
        this._provider.setSchema(domain.getSchema("ApiKey"));
    }

    @Action()
    createToken(command: Command) {
        return this._provider.createAsync(command.data);
    }

    verifyTokenAsync( apiKey ) : Promise<boolean>
    {
        return new Promise( async ( resolve, reject ) =>
        {
            if(!apiKey)
            {
                reject("You must provided a valid token");
                return;
            }

            try
            {
                let token = await this._provider.getAsync(apiKey);
                if(token)
                {
                    resolve({token:token, user:{name:token.userName, id:token.userId, scopes:token.scopes}});
                    return;
                }
                reject({message:"Invalid api key"});
            }
            catch(err)
            {
                reject({error:err, message:"Invalid api key"});
            }
        } );
    }
}