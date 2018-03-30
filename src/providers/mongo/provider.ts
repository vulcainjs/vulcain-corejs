import { DefaultServiceNames } from './../../di/annotations';
import { IProvider, QueryOptions, IProviderFactory } from "../provider";
import { Schema } from "../../schemas/schema";
import { MongoClient } from 'mongodb';
import { Inject } from '../../di/annotations';
import { Service } from '../../globals/system';
import * as URL from 'url';
import * as Path from 'path';
import { Logger } from "../../log/logger";
import { IRequestContext } from "../../pipeline/common";
import { ApplicationError } from "../../pipeline/errors/applicationRequestError";
import { QueryResult } from '../../index';

interface PoolItem {
    provider?: MongoProvider;
    count?: number;
    dispose?: () => void;
}

export class MongoProviderFactory implements IProviderFactory {
    private pool = new Map<string, PoolItem>();

    constructor(private address: string, private options, public maxPoolSize = 20) {
    }

    private addToPool(context: IRequestContext, key: string, item: PoolItem) {
        Service.log.info(context, () => `Adding a new provider pool item : ${key}`);
        if (this.pool.size >= this.maxPoolSize) {
            // remove the least used
            let keyToRemove;
            let min = 0;
            for (const [key, value] of this.pool.entries()) {
                if (!keyToRemove || value.count < min) {
                    keyToRemove = key;
                    min = value.count;
                }
            }
            let item = this.pool.get(keyToRemove);
            item.dispose && item.dispose();
            this.pool.delete(keyToRemove);
            Service.log.info(context, () => `Ejecting ${keyToRemove} from provider pool item.`);
        }
        item.count = 1;
        this.pool.set(key, item);
    }

    private getFromPool(key: string) {
        let item = this.pool.get(key);
        if (item) {
            item.count++;
            return item.provider;
        }
    }

    getConnection<T>(context: IRequestContext, tenant: string): IProvider<T> {
        tenant = tenant || context.user.tenant;
        let poolKey = tenant;
        let provider = this.getFromPool(poolKey);
        if (!provider) {
            provider = new MongoProvider(context, this.address, this.options);
            let item: PoolItem = { provider };
            item.dispose = provider.initialize(context, tenant);
            if (item.dispose) {
                this.addToPool(context, poolKey, item);
            }
        }

        return <IProvider<T>><any>provider;
    }
}

/**
 * Default mongo provider
 */
class MongoProvider implements IProvider<any>
{
    private databaseName: string;
    private logger: Logger;

    public state: {
        keyPropertyNameBySchemas: Map<string, string>;
        uri: string;
        dispose?: () => void;
        mongoClient?: MongoClient;        
    };

    get address() {
        return this.state.uri;
    }

    constructor(
        ctx: IRequestContext,
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
        this.logger = ctx.container.get<Logger>(DefaultServiceNames.Logger);
    }

    initialize( ctx: IRequestContext, tenant?: string): () => any {
        // By default, there is a database base by tenant
        this.databaseName = tenant;

        // If database is provided use it as database name and ignore tenant
        let url = URL.parse(this.state.uri);
        if (url.pathname && url.pathname !== "/") {
            this.databaseName = url.pathname.replace('/', '');
            url.pathname = "/";
        }
        else if (!tenant) {
            throw new Error("tenant is required");
        }

        this.state.uri = URL.format(url);

        Service.log.verbose(ctx, () => `MONGODB: Creating provider ${Service.removePasswordFromUrl(this.state.uri)} for tenant ${tenant}`);
        return this.dispose.bind(this);
    }

    dispose() {
        this.state.mongoClient.close();
        this.state.mongoClient = null;
        this.state.dispose = null;
    }

    private async ensureSchemaReady(ctx: IRequestContext, schema: Schema) {
        if(!this.state.mongoClient)
            await this.openDatabase(ctx);

        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);
        if (keyPropertyName) {
            return Promise.resolve();
        }

        keyPropertyName = schema.getIdProperty() || "_id";
        this.state.keyPropertyNameBySchemas.set(schema.name, keyPropertyName);

        let keys;
        for (let p in schema.info.properties) {
            if (!schema.info.properties.hasOwnProperty(p))
                continue;
            let prop = schema.info.properties[p];
            if (prop.unique) {
                if (!keys) keys = {};
                keys[p] = prop.unique === true ? 1 : prop.unique;
            }
        }

        if (!keys) {
            return Promise.resolve();
        }

        const db = this.state.mongoClient.db(this.databaseName);
        let uri = this.state.uri;

        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connection
            let indexName = schema.info.storageName + "_uniqueIndex";
            db.createIndex(schema.info.storageName, keys, { w: 1, background: true, name: indexName, unique: true },
                (err) => {
                    if (err) {
                        ctx.logError( err, ()=>`MONGODB: Error when creating index for ${Service.removePasswordFromUrl(uri)} for schema ${schema.name}`);
                    }
                    else {
                        ctx.logInfo(()=>`MONGODB: Unique index created for ${Service.removePasswordFromUrl(uri)} for schema ${schema.name}`);
                    }
                    resolve();
                });
        });
    }

    private openDatabase(ctx: IRequestContext) {
        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connection
            MongoClient.connect(this.state.uri, this.options, (err, client) => {
                if (err) {
                    reject(err);
                    ctx.logError(err, ()=>`MONGODB: Error when opening database ${Service.removePasswordFromUrl(this.state.uri)} for tenant ${this.databaseName}`);
                    return;
                }

                this.state.mongoClient = client;
                resolve();
            });
        });
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    async getAll(ctx: IRequestContext,schema: Schema, options: QueryOptions):  Promise<QueryResult> {
        await this.ensureSchemaReady(ctx, schema);

        let page = options.page || 0;
        let pageSize = options.pageSize || 20;

        let proj = options.query && options.query.projections;
        let query;
        if (proj)
            query = options.query.filter;
        else
            query = options.query ? options.query.filter || options.query : {};

        ctx.logInfo(()=>`MONGODB: Get all query on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
        let self = this;
        return new Promise<QueryResult>(async (resolve, reject) => {
            try {
                let db = self.state.mongoClient.db(this.databaseName);
                // TODO try with aggregate
                let total = await db.collection(schema.info.storageName).find(query).count();
                let cursor = db.collection(schema.info.storageName).find(query, proj)
                    .skip(page * pageSize)
                    .limit(pageSize);
                cursor.toArray((err, res) => {
                    if (err) {
                        ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                        reject(err);
                    }
                    else {
                        ctx.logInfo(()=>`MONGODB: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)} returns ${(res && res.length) || 0} values.`);
                        resolve( new QueryResult(res, total));
                    }
                });
            }
            catch (err) {
                ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                reject(err);
            }
        });
    }

    /**
     * Read an entity
     * @param id
     * @returns {Promise}
     */
    async get(ctx: IRequestContext,schema: Schema, id: string) {
        await this.ensureSchemaReady(ctx, schema);

        let filter = {};
        filter[this.state.keyPropertyNameBySchemas.get(schema.name) || "_id"] = id;
        ctx.logInfo(()=>`MONGODB: Get query on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter : ${JSON.stringify(filter)}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = self.state.mongoClient.db(this.databaseName);
                db.collection(schema.info.storageName).findOne(filter, (err, res) => {
                    if (err) {
                        ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(self.normalizeErrors(id, err));
                    }
                    else {
                        ctx.logInfo(()=>`MONGODB: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id} returns a value: ${res !== null}`);
                        resolve(res);
                    }
                });
            }
            catch (err) {
                ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    async delete(ctx: IRequestContext, schema: Schema, id: string): Promise<any> {
        if (!id)
            throw new Error("MONGODB delete: Id is required");
        
        await this.ensureSchemaReady(ctx, schema);
        let self = this;
        return new Promise<any>(async (resolve, reject) => {
            let keyPropertyName = self.state.keyPropertyNameBySchemas.get(schema.name);
            let filter = {};
            filter[keyPropertyName || "_id"] = id;

            try {
                ctx.logInfo(()=>`MONGODB: Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                let old = await this.get(ctx, schema, id);
                if (!old) {
                    ctx.logInfo(()=>`MONGODB: Error when deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)} - Entity must exists.`);                    
                    reject(new Error("MONGODB DELETE ERROR: Entity must exists"));
                    return;
                }
                let db = self.state.mongoClient.db(this.databaseName);
                db.collection(schema.info.storageName).remove(filter, (err, res) => {
                    if (err) {
                        let e = self.normalizeErrors(id, err);
                        ctx.logError(e, ()=>`MONGODB ERROR : Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                        reject(e);
                    }
                    else {
                        ctx.logInfo(()=>`MONGODB: Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}. Result=${res}`);
                        resolve(old);
                    }
                });
            }
            catch (err) {
                ctx.logError(err, ()=>`MONGODB ERROR : Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                reject(err);
            }
        });
    }

    private normalizeErrors(id: string|number, err) {
        if (!err || !err.errors) return err;
        let error = new ApplicationError("Mongo error - " + (err.message || ""));
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
    async create(ctx: IRequestContext, schema: Schema, entity) {
        if (!entity)
            throw new Error("MONGODB create: Entity is required");
        await this.ensureSchemaReady(ctx, schema);

        entity._created = new Date().toUTCString();
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = entity[keyPropertyName];
        if (!id)
            throw new Error(`MONGODB create : ${keyPropertyName} must not be null`);

        ctx.logInfo(()=>`MONGODB: Creating entity on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = self.state.mongoClient.db(this.databaseName);
                db.collection(schema.info.storageName).insertOne(entity, (err) => {
                    if (err) {
                        let e = self.normalizeErrors(entity[keyPropertyName], err);
                        ctx.logError(e, ()=>`MONGODB ERROR : Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                    }
                    else {
                        ctx.logInfo(()=>`MONGODB: Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}. Success=true`);
                        resolve(entity);
                    }
                });
            }
            catch (err) {
                ctx.logError(err, ()=>`MONGODB ERROR : Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }

    /**
     * Update an entity
     * @param entity
     * @returns {Promise<T>}
     */
    async update(ctx: IRequestContext, schema: Schema, entity) {
        if (!entity)
            throw new Error("Entity is required");
        await this.ensureSchemaReady(ctx, schema);
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = entity[keyPropertyName];
        let filter = {};
        filter[keyPropertyName || "_id"] = id;

        ctx.logInfo(()=>`MONGODB: Updating entity on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {

                let db = self.state.mongoClient.db(this.databaseName);
                let collection = db.collection(schema.info.storageName);

                collection.findOne(filter, (err, initial) => {
                    if (err) {
                        let e = self.normalizeErrors(id, err);
                        ctx.logError(e, ()=>`MONGODB ERROR : Updating entity (check if exists) on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                        return;
                    }
                    if (!initial) {
                        err = new ApplicationError(`Can not update unknown entity ${id}, schema: ${schema.name}`);
                        ctx.logError(err, ()=>`MONGODB ERROR : Error when updating entity ${id}, schema: ${schema.name}`);
                        reject(err);
                        return;
                    }

                    let _id = initial._id;
                    initial = schema.deepAssign(initial, entity);
                    initial._updated = new Date().toUTCString();
                    initial._id = _id;

                    collection.updateOne(filter, { $set: initial }, err => {
                        if (err) {
                            let e = self.normalizeErrors(id, err);
                            ctx.logError(e, ()=>`MONGODB ERROR : Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                            reject(e);
                        }
                        else {
                            ctx.logInfo(()=>`MONGODB: Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}. Success`);
                            resolve(initial);
                        }
                    });
                });
            }
            catch (err) {
                ctx.logError(err, ()=>`MONGODB ERROR : Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }
}
