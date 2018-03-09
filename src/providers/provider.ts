
import {Schema} from "../schemas/schema";
import { IRequestContext } from "../pipeline/common";
import { QueryResult } from "../index";

export interface QueryOptions {
    /**
     * Page size (default 20)
     */
    pageSize?: number;  // 0 for all
    /**
     * Page to returns
     *
     */
    page?: number;       
    /**
     * Optional filter
     */
    query?: {
        filter?: any;
        projections?: any;
        sort?: any;
    };
}

/**
 * Connection factory
 */
export interface IProviderFactory {
    /**
     * Create a connection from a pool
     * @param context Current context
     * @param tenant Tenant
     */
    getConnection<T=any>(context: IRequestContext, tenant: string): IProvider<T>;
}

/**
 * Persistance provider for a schema
 */
export interface IProvider<T=any>
{
    /**
     * Server address     
     */
    address: string;

    /**
     * Get an entity list
     *
     * @param {IRequestContext} ctx Current context
     * @param {Schema} schema Entity schema
     * @param {QueryOptions} options
     * @returns {Promise<Array<T>>}
     *
     * @memberOf IProvider
     */
    getAll(ctx: IRequestContext, schema: Schema, options: QueryOptions): Promise<QueryResult>;
    /**
     * Get an entity by id
     *
     * @param {IRequestContext} ctx Current context
     * @param {Schema} schema Entity schema
     * @param {string} id
     * @returns {Promise<T>} 
     *
     * @memberOf IProvider
     */
    get(ctx: IRequestContext, schema: Schema, id: string): Promise<T>;
    /**
     * Create an entity
     *
     * @param {IRequestContext} ctx Current context
     * @param {Schema} schema Entity schema
     * @param {T} entity
     * @returns {Promise<T>} The created entity
     *
     * @memberOf IProvider
     */
    create(ctx: IRequestContext, schema: Schema, entity: T): Promise<T>;
    /**
     * Update an entity
     *
     * @param {IRequestContext} ctx Current context
     * @param {Schema} schema Entity schema
     * @param {T} entity Entity to update
     * @returns {Promise<T>} The updated entity
     *
     * @memberOf IProvider
     */
    update(ctx: IRequestContext, schema: Schema, entity: T): Promise<T>;
    /**
     * Delete an entity - Must returns the deleted entity or raise an error if id does not exist
     * 
     * @param {IRequestContext} ctx Current context
     * @param {Schema} schema Entity schema
     * @param {(string)} id Id 
     * @returns {Promise<T>} Deleted entity 
     */
    delete(ctx: IRequestContext, schema: Schema, id: string ) : Promise<T>;
}

