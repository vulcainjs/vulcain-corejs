import * as fs from 'fs'
import {IProvider, ListOptions} from "../provider";
import {Schema} from "../../schemas/schema";
import {Inject} from '../../di/annotations';
/**
 * Default memory provider
 */
export class MemoryProvider implements IProvider<any>
{
    private _data:Map<string, any> = new Map<string,any>();
    private _saveToFile:string;
    private _length                = 0;

    /**
     * Create a memory provider instance.
     * @param dataFolder : (optional) if provided, data will be persisted on disk on EVERY create, update or delete
     */
    constructor( private _schema:Schema, private dataFolder?:string )
    {
        if (!this._schema)
            throw new Error("Schema is not set for the current provider.");

        if (!this._schema)
            throw new Error("Schema can not be null");
        
        if( this.dataFolder && this._data.size === 0)
        {
           // console.log("Create memory provider for " + schema.name);
            if( !fs.existsSync( this.dataFolder ) )
                fs.mkdirSync( this.dataFolder );

            this._saveToFile = this.dataFolder + "/" + this._schema.name + ".json";

            if( fs.existsSync( this._saveToFile ) )
            {
                let items = JSON.parse( fs.readFileSync( this._saveToFile, "UTF-8" ) );
                if( items )
                {
                    this._length = items._length;
                    items.forEach( i=>
                    {
                        this._data.set( i[0], i[1] );
                    } );
                }
            }
        }
    }

    static clone(obj)
    {
        return obj && Object.assign({}, obj);
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAllAsync( options:ListOptions ) : Promise<Array<any>>
    {
        options = options || {limit:-1};
        return new Promise( ( resolve, reject ) =>
            {
                try
                {
                    let result     = Array.from( this.take( this._data, options ) );
                    options.length = result.length;
                    resolve( result );
                }
                catch( err )
                {
                    reject( err );
                }
            }
        );
    }


    public *take( list, options:ListOptions )
    {
        let self =this;
        let take = options.limit || -1;
        let skip = take * (options.page || 0);
        let cx=0;
        for( var v of list.values() )
        {
            if(!v || options.query && !self.filter(v, options.query )) continue;

            if( cx < skip ) {cx++;continue;}
            if( take < 0 || cx < skip + take )
            {
                cx++;
                yield MemoryProvider.clone(v);
            }
            else
                break;
        }
    }

    private filter( elem, config, flag?:boolean )
    {
        flag = !!flag;
        let metadata = this._schema;
        for( var field in config )
        {
            if( !config.hasOwnProperty( field ) )
                continue;

            var val;
            var data = config[field];
            switch( field )
            {
                case "$schema":
                    val = metadata.name;
                    break;
               // case "$filter":
               //     if( data( elem ) === flag )
               //         return flag;
               //     break;
                case "$or":
                    if( this.filter( elem, data, true ) === flag )
                        return flag;
                    break;
                case "_id":
                    val = metadata.getId(elem);
                    break;
                default:
                    if( field[0] == '$' )
                        continue;
                    val = elem[field];
            }

            var r = !flag;
            if( data instanceof RegExp )
            {
                r = data.test( val );
            }
            else if( typeof(data) === "object" )
            {
                r = this.evalExpression( val, data );
            }
            else
            {
                r = val === data;
            }

            if( r === flag )
                return flag;

        }

        return !flag;
    }

    private evalExpression( val, query ):boolean
    {
        for( var op in query )
        {
            if(!query.hasOwnProperty(op)) continue;

            var lit = query[op];
            switch( op )
            {
                case "$eq":
                    if(val === lit) continue;
                    return false;
                case "$lt":
                    if( val < lit) continue;
                    return false;
                case "$gt":
                    if(val > lit) continue;
                    return false;
                case "$le":
                    if( val <= lit) continue;
                    return false;
                case "$ge":
                    if( val >= lit) continue;
                    return false;
                case "$ne":
                    if( val !== lit) continue;
                    return false;
                case "$in":
                    if( lit.indexOf(val) >= 0) continue;
                    return false;
                case "$startsWith":
                    if( (<string>val).startsWith(lit)) continue;
                    return false;
                default:
                    throw new Error("Operator not implemented");
            }
        }
        return true;
    }

    async findOneAsync( query )
    {
        let options = <ListOptions>{};
        options.query = query;
        let list = await this.getAllAsync(options);
        return list && list.length > 0 ? list[0] : null;
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    getAsync( name:string )
    {
        var self = this;
        return new Promise( ( resolve, reject ) =>
        {
            try {
                resolve( MemoryProvider.clone(self._data.get( name ) ));
            }
            catch(err) {
                reject(err);
            }
        } );
    }

    private save()
    {
        if( !this._saveToFile ) return;
        fs.writeFileSync( this._saveToFile, JSON.stringify( Array.from( this._data.entries() ) ), "UTF-8" )
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    deleteAsync(old: string | any) {
        if (!old)
            throw new Error("Argument is required");

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let id;
                if (typeof old === "string")
                    id = old;
                else
                    id = this._schema.getId(old);

                if (self._data.has(id)) {
                    this._length--;
                    self._data.delete(id)
                    self.save();
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Persist an entity
     * @param entity
     * @returns {Promise}
     */
    createAsync( entity )
    {
        if (!entity)
            throw new Error("Entity is required");

        var self = this;
        entity._created = new Date().toUTCString();

        return new Promise((resolve, reject) =>
        {
            try
            {
                let name = self._schema.getId( entity );
                if( self._data.has( name ) )
                {
                    reject( new Error( "Can not add existing entity " + name ) );
                    return;
                }
                self._length++;
                self._data.set( name, MemoryProvider.clone( entity ) );
                self.save();
                resolve( entity );
            }
            catch(err) {
                reject(err);
            }
        } );
    }

    /**
     * Update an entity
     * @param entity
     * @param old
     * @returns {Promise<T>}
     */
    updateAsync( entity, old )
    {
        if (!entity)
            throw new Error("Entity is required");

        entity._updated = new Date().toUTCString();

        let self = this;
        return new Promise( ( resolve, reject ) =>
            {
                try
                {
                    let name = self._schema.getId( entity );
                    if( !self._data.has( name ) )
                    {
                        reject( "Entity doesn't exist. " + name );
                        return;
                    }
                    self._data.set( name, MemoryProvider.clone( entity ) );
                    self.save();
                    resolve( entity );
                }
                catch( err )
                {
                    reject( err );
                }
            }
        );
    }
}
