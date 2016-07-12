
import {Schema} from "../schemas/schema";

export interface ListOptions {
    limit:number;       // 0 for all
    page?:number;       //
    length?:number;
    pages?:number;
    query?:any;
}

/**
 *
 */
export interface IProvider<T>
{
    setSchema(schema:Schema);
    findOneAsync(query): Promise<T>;
    getAllAsync( options:ListOptions ) : Promise<Array<T>>;
    getAsync( id:string ) : Promise<T>;
    createAsync( entity:T ) : Promise<T>;
    updateAsync( entity:T, old:T ) : Promise<T>;
    deleteAsync( old:string|T ) : Promise<boolean>;
}

