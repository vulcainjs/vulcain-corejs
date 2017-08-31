import { DefaultServiceNames } from './../../di/annotations';
import { IProvider, ListOptions } from "../provider";
import { Schema } from "../../schemas/schema";
import { MongoClient } from 'mongodb';
import { Inject } from '../../di/annotations';
import { System } from '../../configurations/globals/system';
import * as URL from 'url';
import * as Path from 'path';
import { Logger } from "../../configurations/log/logger";
import { RequestContext } from "../../pipeline/requestContext";
import { ApplicationRequestError } from "../../pipeline/errors/applicationRequestError";

/**
 * Default mongo provider
 */
export class MongoProvider implements IProvider<any>
{
    public state: {
        keyPropertyNameBySchemas: Map<string, string>;
        uri: string;
        dispose?: () => void;
        _mongo?;
    };

    get address() {
        return this.state.uri;
    }

    constructor(
        @Inject(DefaultServiceNames.Logger) private _logger: Logger,
        @Inject(DefaultServiceNames.RequestContext, true) private ctx: RequestContext,
        uri: string,
        private options?) {
        this.options = this.options || {authSource: "admin"};
        // Try to fix topology was destroy error
        /* this.options.socketOptions = this.options.socketOptions || {
             noDelay: true,
             connectTimeoutMS: 0,
             socketTimeoutMS: 0
         };*/
        if (!uri) {
            throw new Error("Uri is required for mongodb provider.");
        }
        this.state = { uri: uri, keyPropertyNameBySchemas: new Map<string, string>() };
    }

    initializeTenantAsync(context: RequestContext, tenant: string) : Promise<() => Promise<any>> {
        if (!tenant)
            throw new Error("tenant is required");

        // Insert tenant into connexion string
        let url = URL.parse(this.state.uri);
        // If no database is provide just use the tenant as database name
        if( !url.pathname || url.pathname === "/")
            url.pathname = tenant;
        else
            // else suffix the database name with the tenant
            url.pathname += "_" + tenant;
        this.state.uri = URL.format(url);

        this.ctx.logVerbose(()=>`MONGODB: Creating provider ${System.removePasswordFromUrl(this.state.uri)} for tenant ${tenant}`);

        const state = this.state;
        const options = this.options;

        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connexion
            MongoClient.connect(state.uri, options, (err, db) => {
                if (err) {
                    reject(err);
                    System.log.error(this.ctx, err, ()=>`MONGODB: Error when opening database ${System.removePasswordFromUrl(this.state.uri)} for tenant ${tenant}`);
                    return;
                }

                state._mongo = db;

                resolve(async () => {
                    db.close();
                    state._mongo = null;
                    state.dispose = null;
                });
            });
        });
    }

    private ensureSchemaReadyAsync(schema: Schema) {
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);
        if (keyPropertyName) {
            return Promise.resolve();
        }

        keyPropertyName = schema.getIdProperty() || "_id";
        this.state.keyPropertyNameBySchemas.set(schema.name, keyPropertyName);

        let keys;
        for (let p in schema.description.properties) {
            if (!schema.description.properties.hasOwnProperty(p))
                continue;
            let prop = schema.description.properties[p];
            if (prop.unique) {
                if (!keys) keys = {};
                keys[p] = prop.unique === true ? 1 : prop.unique;
            }
        }

        if (!keys) {
            return Promise.resolve();
        }

        const db = this.state._mongo;

        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connexion
            let indexName = schema.description.storageName + "_uniqueIndex";
            db.createIndex(schema.description.storageName, keys, { w: 1, background: true, name: indexName, unique: true },
                (err) => {
                    if (err) {
                        System.log.error(this.ctx, err, ()=>`MONGODB: Error when creating index for ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name}`);
                    }
                    else {
                        System.log.info(this.ctx, ()=>`MONGODB: Unique index created for ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name}`);
                    }
                    resolve();
                });
        });
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    async getAllAsync(schema: Schema, options: ListOptions): Promise<Array<any>> {
        await this.ensureSchemaReadyAsync(schema);

        let page = options.page || 0;
        let maxByPage = options.maxByPage || 100;
        let query = options.query ? options.query.filter || options.query : {};

        this.ctx.logVerbose(()=>`MONGODB: Get all query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);

        return new Promise<Promise<Array<any>>>(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                let cursor = db.collection(schema.description.storageName).find(query)
                    .skip(page * maxByPage)
                    .limit(maxByPage);
                cursor.toArray((err, res) => {
                    if (err) {
                        this.ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                        reject(err);
                    }
                    else {
                        this.ctx.logVerbose(()=>`MONGODB: Get all query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)} returns ${(res && res.length) || 0} values.`);
                        resolve(res);
                    }
                });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                reject(err);
            }
        });
    }

    async findOneAsync(schema: Schema, query) {
        await this.ensureSchemaReadyAsync(schema);
        this.ctx.logVerbose(()=>`MONGODB: Get findone on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                db.collection(schema.description.storageName).findOne(query,
                    (err, res) => {
                        if (err) {
                            this.ctx.logError(err, ()=>`MONGODB: Get findone on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);
                            reject(err);
                        }
                        else {
                            this.ctx.logVerbose(()=>`MONGODB: Get findone on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)} returns ${(res && res.length) || 0} values.`);
                            resolve(res);
                        }
                    });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB: Get findone on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);
                reject(err);
            }
        });
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    async getAsync(schema: Schema, name: string) {
        await this.ensureSchemaReadyAsync(schema);

        let filter = {};
        filter[this.state.keyPropertyNameBySchemas.get(schema.name) || "_id"] = name;
        this.ctx.logVerbose(()=>`MONGODB: Get query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter : ${JSON.stringify(filter)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                db.collection(schema.description.storageName).findOne(filter, (err, res) => {
                    if (err) {
                        this.ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${name}`);
                        reject(this.normalizeErrors(name, err));
                    }
                    else {
                        this.ctx.logVerbose(()=>`MONGODB: Get query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${name} returns a value: ${res !== null}`);
                        resolve(res);
                    }
                });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${name}`);
                reject(err);
            }
        });
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    async deleteAsync(schema: Schema, old: string | any) {
        if (!old)
            throw new Error("MONGODB delete: Argument is required");
        await this.ensureSchemaReadyAsync(schema);

        return new Promise<boolean>(async (resolve, reject) => {
            let id;
            let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);
            if (typeof old === "string")
                id = old;
            else
                id = old[keyPropertyName];
            if (!id)
                throw new Error(`MONGODB delete : Id must not be null`);
            let filter = {};
            filter[keyPropertyName || "_id"] = id;

            try {
                this.ctx.logVerbose(()=>`MONGODB: Deleting entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);

                let db = this.state._mongo;
                db.collection(schema.description.storageName).remove(filter, (err, res) => {
                    if (err) {
                        let e = this.normalizeErrors(id, err);
                        this.ctx.logError(e, ()=>`MONGODB ERROR : Deleting entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                        reject(e);
                    }
                    else {
                        this.ctx.logVerbose(()=>`MONGODB: Deleting entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}. Result=${res}`);
                        resolve();
                    }
                });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB ERROR : Deleting entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                reject(err);
            }
        });
    }

    private normalizeErrors(id: string, err) {
        if (!err || !err.errors) return err;
        let error = new ApplicationRequestError("Mongo error - " + (err.message || ""));
        if (err.errors) {
            for (let e in err.errors) {
                if (!err.errors.hasOwnProperty(e)) continue;
                let error = err.errors[e];
                error.errors.push({ message: error.message, property: error.path, id: id });
            }
        }
        return error;
    }

    /**
     * Persist an entity
     * @param entity
     * @returns {Promise}
     */
    async createAsync(schema: Schema, entity) {
        if (!entity)
            throw new Error("MONGODB create: Entity is required");
        await this.ensureSchemaReadyAsync(schema);

        entity._created = new Date().toUTCString();
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = entity[keyPropertyName];
        if (!id)
            throw new Error(`MONGODB create : ${keyPropertyName} must not be null`);

        this.ctx.logVerbose(()=>`MONGODB: Creating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);

        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                db.collection(schema.description.storageName).insertOne(entity, (err) => {
                    if (err) {
                        let e = this.normalizeErrors(entity[keyPropertyName], err);
                        this.ctx.logError(e, ()=>`MONGODB ERROR : Creating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                    }
                    else {
                        this.ctx.logVerbose(()=>`MONGODB: Creating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}. Success=true`);
                        resolve(entity);
                    }
                });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB ERROR : Creating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }

    /**
     * Update an entity
     * @param entity
     * @param old
     * @returns {Promise<T>}
     */
    async updateAsync(schema: Schema, entity, old) {
        if (!entity)
            throw new Error("Entity is required");
        await this.ensureSchemaReadyAsync(schema);
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = (old || entity)[keyPropertyName];
        let filter = {};
        filter[keyPropertyName || "_id"] = id;

        this.ctx.logVerbose(()=>`MONGODB: Updating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);

        return new Promise(async (resolve, reject) => {
            try {

                let db = this.state._mongo;
                let collection = db.collection(schema.description.storageName);

                collection.findOne(filter, (err, initial) => {
                    if (err) {
                        let e = this.normalizeErrors(id, err);
                        this.ctx.logError(e, ()=>`MONGODB ERROR : Updating entity (check if exists) on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                        return;
                    }
                    if (!initial) {
                        err = new Error(`Can not update unknow entity ${id}, schema: ${schema.name}`);
                        this.ctx.logError(err, ()=>`MONGODB ERROR : Error when updating entity ${id}, schema: ${schema.name}`);
                        reject(err);
                        return;
                    }

                    let _id = initial._id;
                    initial = schema.deepAssign(initial, entity);
                    initial._updated = new Date().toUTCString();
                    initial._id = _id;

                    collection.updateOne(filter, initial, err => {
                        if (err) {
                            let e = this.normalizeErrors(id, err);
                            this.ctx.logError(e, ()=>`MONGODB ERROR : Updating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
                            reject(e);
                        }
                        else {
                            this.ctx.logVerbose(()=>`MONGODB: Updating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}. Success`);
                            resolve(initial);
                        }
                    });
                });
            }
            catch (err) {
                this.ctx.logError(err, ()=>`MONGODB ERROR : Updating entity on ${System.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }
}
