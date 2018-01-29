import { DefaultServiceNames } from './../../di/annotations';
import { IProvider, ListOptions } from "../provider";
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

/**
 * Default mongo provider
 */
export class MongoProvider implements IProvider<any>
{
    ctx: IRequestContext;
    private tenant: string;

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

    setTenant(tenant: string): () => any {
        // Don't use this.ctx in this method (Not initialized yet)
        if (!tenant)
            throw new Error("tenant is required");

        this.tenant = tenant;
        // Insert tenant into connection string
        let url = URL.parse(this.state.uri);
        // If no database is provided just use the tenant as database name
        if( !url.pathname || url.pathname === "/")
            url.pathname = tenant;
        else
            // else suffix the database name with the tenant
            url.pathname += "_" + tenant;
        this.state.uri = URL.format(url);

        Service.log.verbose(null, () => `MONGODB: Creating provider ${Service.removePasswordFromUrl(this.state.uri)} for tenant ${tenant}`);
        return this.dispose.bind(this);
    }

    dispose() {
        this.state._mongo.close();
        this.state._mongo = null;
        this.state.dispose = null;
    }

    private async ensureSchemaReady(schema: Schema) {
        if(!this.state._mongo)
            await this.openDatabase();

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

        const db = this.state._mongo;
        let self = this;
        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connection
            let indexName = schema.info.storageName + "_uniqueIndex";
            db.createIndex(schema.info.storageName, keys, { w: 1, background: true, name: indexName, unique: true },
                (err) => {
                    if (err) {
                        self.ctx.logError( err, ()=>`MONGODB: Error when creating index for ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name}`);
                    }
                    else {
                        self.ctx.logInfo(()=>`MONGODB: Unique index created for ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name}`);
                    }
                    resolve();
                });
        });
    }

    private openDatabase() {
        return new Promise((resolve, reject) => {
            // Don't use 'this' here to avoid memory leaks
            // Open connection
            MongoClient.connect(this.state.uri, this.options, (err, db) => {
                if (err) {
                    reject(err);
                    this.ctx.logError(err, ()=>`MONGODB: Error when opening database ${Service.removePasswordFromUrl(this.state.uri)} for tenant ${this.tenant}`);
                    return;
                }

                this.state._mongo = db;
                resolve();
            });
        });
    }
    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    async getAll(schema: Schema, options: ListOptions):  Promise<QueryResult> {
        await this.ensureSchemaReady(schema);

        let page = options.page || 0;
        let maxByPage = options.maxByPage || 20;
        let query = options.query ? options.query.filter || options.query : {};

        this.ctx.logInfo(()=>`MONGODB: Get all query on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
        let self = this;
        return new Promise<QueryResult>(async (resolve, reject) => {
            try {
                let db = self.state._mongo;
                // TODO try with aggregate
                let total = await db.collection(schema.info.storageName).find(query).count();
                let cursor = db.collection(schema.info.storageName).find(query)
                    .skip(page * maxByPage)
                    .limit(maxByPage);
                cursor.toArray((err, res) => {
                    if (err) {
                        self.ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                        reject(err);
                    }
                    else {
                        self.ctx.logInfo(()=>`MONGODB: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)} returns ${(res && res.length) || 0} values.`);
                        resolve( new QueryResult(res, total));
                    }
                });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB ERROR: Get all query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query: ${JSON.stringify(query)}`);
                reject(err);
            }
        });
    }

    async findOne(schema: Schema, query) {
        await this.ensureSchemaReady(schema);
        this.ctx.logInfo(()=>`MONGODB: Get findone on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = self.state._mongo;
                db.collection(schema.info.storageName).findOne(query,
                    (err, res) => {
                        if (err) {
                            self.ctx.logError(err, ()=>`MONGODB: Get findone on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);
                            reject(err);
                        }
                        else {
                            self.ctx.logInfo(()=>`MONGODB: Get findone on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)} returns ${(res && res.length) || 0} values.`);
                            resolve(res);
                        }
                    });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB: Get findone on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with query : ${JSON.stringify(query)}`);
                reject(err);
            }
        });
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    async get(schema: Schema, name: string) {
        await this.ensureSchemaReady(schema);

        let filter = {};
        filter[this.state.keyPropertyNameBySchemas.get(schema.name) || "_id"] = name;
        this.ctx.logInfo(()=>`MONGODB: Get query on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with filter : ${JSON.stringify(filter)}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = self.state._mongo;
                db.collection(schema.info.storageName).findOne(filter, (err, res) => {
                    if (err) {
                        self.ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${name}`);
                        reject(self.normalizeErrors(name, err));
                    }
                    else {
                        self.ctx.logInfo(()=>`MONGODB: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${name} returns a value: ${res !== null}`);
                        resolve(res);
                    }
                });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB ERROR: Get query on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${name}`);
                reject(err);
            }
        });
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    async delete(schema: Schema, old: string | any) {
        if (!old)
            throw new Error("MONGODB delete: Argument is required");
        await this.ensureSchemaReady(schema);
        let self = this;
        return new Promise<boolean>(async (resolve, reject) => {
            let id;
            let keyPropertyName = self.state.keyPropertyNameBySchemas.get(schema.name);
            if (typeof old === "string")
                id = old;
            else
                id = old[keyPropertyName];
            if (!id)
                throw new Error(`MONGODB delete : Id must not be null`);
            let filter = {};
            filter[keyPropertyName || "_id"] = id;

            try {
                self.ctx.logInfo(()=>`MONGODB: Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);

                let db = self.state._mongo;
                db.collection(schema.info.storageName).remove(filter, (err, res) => {
                    if (err) {
                        let e = self.normalizeErrors(id, err);
                        self.ctx.logError(e, ()=>`MONGODB ERROR : Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                        reject(e);
                    }
                    else {
                        self.ctx.logInfo(()=>`MONGODB: Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}. Result=${res}`);
                        resolve();
                    }
                });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB ERROR : Deleting entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);
                reject(err);
            }
        });
    }

    private normalizeErrors(id: string, err) {
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
    async create(schema: Schema, entity) {
        if (!entity)
            throw new Error("MONGODB create: Entity is required");
        await this.ensureSchemaReady(schema);

        entity._created = new Date().toUTCString();
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = entity[keyPropertyName];
        if (!id)
            throw new Error(`MONGODB create : ${keyPropertyName} must not be null`);

        this.ctx.logInfo(()=>`MONGODB: Creating entity on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = self.state._mongo;
                db.collection(schema.info.storageName).insertOne(entity, (err) => {
                    if (err) {
                        let e = self.normalizeErrors(entity[keyPropertyName], err);
                        self.ctx.logError(e, ()=>`MONGODB ERROR : Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                    }
                    else {
                        self.ctx.logInfo(()=>`MONGODB: Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}. Success=true`);
                        resolve(entity);
                    }
                });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB ERROR : Creating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
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
    async update(schema: Schema, entity, old) {
        if (!entity)
            throw new Error("Entity is required");
        await this.ensureSchemaReady(schema);
        let keyPropertyName = this.state.keyPropertyNameBySchemas.get(schema.name);

        let id = (old || entity)[keyPropertyName];
        let filter = {};
        filter[keyPropertyName || "_id"] = id;

        this.ctx.logInfo(()=>`MONGODB: Updating entity on ${Service.removePasswordFromUrl(this.state.uri)} for schema ${schema.name} with id: ${id}`);
        let self = this;
        return new Promise(async (resolve, reject) => {
            try {

                let db = self.state._mongo;
                let collection = db.collection(schema.info.storageName);

                collection.findOne(filter, (err, initial) => {
                    if (err) {
                        let e = self.normalizeErrors(id, err);
                        self.ctx.logError(e, ()=>`MONGODB ERROR : Updating entity (check if exists) on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                        reject(e);
                        return;
                    }
                    if (!initial) {
                        err = new ApplicationError(`Can not update unknown entity ${id}, schema: ${schema.name}`);
                        self.ctx.logError(err, ()=>`MONGODB ERROR : Error when updating entity ${id}, schema: ${schema.name}`);
                        reject(err);
                        return;
                    }

                    let _id = initial._id;
                    initial = schema.deepAssign(initial, entity);
                    initial._updated = new Date().toUTCString();
                    initial._id = _id;

                    collection.updateOne(filter, initial, err => {
                        if (err) {
                            let e = self.normalizeErrors(id, err);
                            self.ctx.logError(e, ()=>`MONGODB ERROR : Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                            reject(e);
                        }
                        else {
                            self.ctx.logInfo(()=>`MONGODB: Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}. Success`);
                            resolve(initial);
                        }
                    });
                });
            }
            catch (err) {
                self.ctx.logError(err, ()=>`MONGODB ERROR : Updating entity on ${Service.removePasswordFromUrl(self.state.uri)} for schema ${schema.name} with id: ${id}`);
                reject(err);
            }
        });
    }
}
