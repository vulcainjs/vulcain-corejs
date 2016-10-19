
import {Schema} from "../schemas/schema";

export interface ListOptions {
    maxByPage?:number;  // 0 for all
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
    initializeWithSchema(tenant: string, schema: Schema);
    findOneAsync(schema: Schema,query): Promise<T>;
    getAllAsync(schema: Schema, options:ListOptions ) : Promise<Array<T>>;
    getAsync(schema: Schema, id:string ) : Promise<T>;
    createAsync(schema: Schema, entity:T ) : Promise<T>;
    updateAsync(schema: Schema, entity:T, old?:T ) : Promise<T>;
    deleteAsync(schema: Schema, old:string|T ) : Promise<boolean>;
}

