
import {Schema} from "../schemas/schema";
import { IRequestContext } from "../pipeline/common";

export interface ListOptions {
    /**
     * Max
     *
     * @type {number}
     * @memberOf ListOptions
     */
    maxByPage?: number;  // 0 for all
    /**
     * Page to returns
     *
     * @type {number}
     * @memberOf ListOptions
     */
    page?: number;       //
    /**
     * [Output property] Number of items founded
     *
     * @type {number}
     * @memberOf ListOptions
     */
    length?:number;
    query?:any;
}

export class GetAllResult {
    constructor(public values: Array<any>, public total?: number) {}
}

/**
 * Persistance provider for a schema
 */
export interface IProvider<T>
{
    /**
     * address of the database
     *
     * @type {string}
     * @memberOf IProvider
     */
    address: string;
    /**
     * Initialize the provider with a tenant and a schema.
     * Called only once by tenant
     *
     * @param {string} tenant - The tenant to use
     * @returns {() => Promise<any>} Dispose function
     *
     * @memberOf IProvider
     */
    setTenant(tenant: string): () => void;
    /**
     * Find an entity
     *
     * @param {Schema} schema
     * @param {any} query provider specific query
     * @returns {Promise<T>}
     *
     * @memberOf IProvider
     */
    findOne(schema: Schema, query): Promise<T>;
    /**
     * Get an entity list
     *
     * @param {Schema} schema
     * @param {ListOptions} options
     * @returns {Promise<Array<T>>}
     *
     * @memberOf IProvider
     */
    getAll(schema: Schema, options: ListOptions): Promise<GetAllResult>;
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
     * @param {T} [old]
     * @returns {Promise<T>}
     *
     * @memberOf IProvider
     */
    update(schema: Schema, entity: T, old?: T): Promise<T>;
    /**
     * Delete an entity
     *
     * @param {Schema} schema
     * @param {(string|T)} old
     * @returns {Promise<boolean>}
     *
     * @memberOf IProvider
     */
    delete(schema: Schema, old:string|T ) : Promise<boolean>;
}

