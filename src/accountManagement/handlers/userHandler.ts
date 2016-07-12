import {IProvider, ListOptions, Inject, Injectable, LifeTime, CommandHandler} from '../../core'
import {User} from '../models/user';
var uuid = require('node-uuid');
var bcrypt = require('bcrypt-nodejs');

@CommandHandler({async:false, scope:"?", schema:"ApiKey", serviceName:"ApiKeyService"})
export class UserHandler
{
    constructor( @Inject( "Domain" ) domain, @Inject( "Provider" ) private _provider:IProvider<User> )
    {
    }

    setSchema( schema ) {this._provider.setSchema(schema);}

    getAllAsync( options:ListOptions ):Promise<Array<any>>
    {
        return this._provider.getAllAsync( options );
    }

    getAsync( id:string ):Promise<any>
    {
        return this._provider.getAsync( id );
    }

    findOneAsync( query:any ):Promise<any>
    {
        return this._provider.findOneAsync( query );
    }

    async verifyPasswordAsync( original, pwd )
    {
        return new Promise( ( resolve, reject ) =>
        {
            if( !original ) {
                resolve(false);
                return;
            }
            bcrypt.compare( pwd, original, function( err, isMatch )
            {
                if( err )
                    reject( err );
                else
                    resolve( isMatch );
            } );
        } );
    }

    private async hashPassword( pwd:string )
    {
        return new Promise( ( resolve, reject ) =>
        {
            bcrypt.hash( pwd, null, null, function( err, hash )
            {
                if( err )
                {
                    reject( err );
                    return;
                }
                resolve( hash );
            } );
        } );
    }

    async createAsync( user, req ):Promise<any>
    {
        user.id = uuid.v1();
        if(user.password)
            user.password = await this.hashPassword( user.password );
        return this._provider.createAsync( user );
    }

    async updateAsync( user, old , req):Promise<any>
    {
        if( user.password && user.password !== old.password )
            user.password = await this.hashPassword( user.password );
        else
            user.password = old.password;
        user.id = old.id;
        return this._provider.updateAsync( user, old );
    }

    deleteAsync( old, req ):Promise<boolean>
    {
        return this._provider.deleteAsync( old );
    }
}
