
import {Schema} from "../schemas/schema";
import { IRequestContext } from "../pipeline/common";
import { QueryResult } from "../index";

export interface QueryOptions {
    /**
     * Max
     *
     * @type {number}
     * @memberOf ListOptions
     */
    pageSize?: number;  // 0 for all
    /**
     * Page to returns
     *
     * @type {number}
     * @memberOf ListOptions
     */
    page?: number;       
    /**
     * 
     */
    query?: {
        filter?: any;
        projections?: any;
        sort?: any;
    }
}

/**
 * Persistance provider for a schema
 */
export interface IProvider<T>
{
    /**
     * Server address
     *
     * @type {string}
     * @memberOf IProvider
     */
    address: string;
    /**
     * Initialize the provider with tenant and schema.
     * Called only once by tenant
     *
     * @param {string} tenant - The tenant to use
     * @returns {() => Promise<any>} Dispose function
     *
     * @memberOf IProvider
     */
    setTenant(tenant: string): () => void;
    /**
     * Get an entity list
     *
     * @param {Schema} schema
     * @param {QueryOptions} options
     * @returns {Promise<Array<T>>}
     *
     * @memberOf IProvider
     */
    getAll(schema: Schema, options: QueryOptions): Promise<QueryResult>;
    /**
     * Get an entity by id
     *
     * @param {Schema} schema
     * @param {string} id
     * @returns {Promise<T>}
     *
     * @memberOf IProvider
     */
    get(schema: Schema, id: string): Promise<T>;
    /**
     * Create an entity
     *
     * @param {Schema} schema
     * @param {T} entity
     * @returns {Promise<T>}
     *
     * @memberOf IProvider
     */
    create(schema: Schema, entity: T): Promise<T>;
    /**
     * Update an entity
     *
     * @param {Schema} schema
     * @param {T} entity
     * @returns {Promise<T>}
     *
     * @memberOf IProvider
     */
    update(schema: Schema, entity: T): Promise<T>;
    /**
     * Delete an entity - Must returns the deleted entity.
     *
     * @param {Schema} schema
     * @param {(string|T)} old
     * @returns {Promise<boolean>}
     *
     * @memberOf IProvider
     */
    delete(schema: Schema, id: string ) : Promise<T>;
}

