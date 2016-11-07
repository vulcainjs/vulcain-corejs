import { DefaultServiceNames } from './../../di/annotations';
import { Logger, RequestContext } from './../../servers/requestContext';
import { IProvider, ListOptions } from "../provider";
import { Schema } from "../../schemas/schema";
import { MongoClient } from 'mongodb';
import { Inject } from '../../di/annotations';
import { ApplicationRequestError } from '../../errors/applicationRequestError';

/**
 * Default mongo provider
 */
export class MongoProvider implements IProvider<any>
{
    public state: {
        keyPropertyName?: string;
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
        this.state = { uri: uri };
    }

    initializeWithSchemaAsync(tenant: string, schema: Schema): any {
        if (!schema)
            throw new Error("schema is not set for provider.");
        if (!tenant)
            throw new Error("tenant is required");

        this.state.uri = this.state.uri + "/" + tenant;
        this.state.keyPropertyName = schema.getIdProperty() || "_id";

        this.ctx.logVerbose(`MONGODB: Creating provider ${this.state.uri} for schema ${schema.name}`);

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

        const self = this;
        return new Promise((resolve, reject) => {
            // Open connexion
            MongoClient.connect(self.state.uri, self.options, (err, db) => {
                if (err) {
                    reject(err);
                    this._logger.error(self.ctx, err, `MONGODB: Error when opening database ${this.state.uri} for schema ${schema.name}`);
                    return;
                }

                this.state._mongo = db;

                this.state.dispose = () => {
                    db.close();
                };

                if (keys) {
                    let indexName = schema.description.storageName + "_uniqueIndex";
                    db.createIndex(schema.description.storageName, keys, { w: 1, background: true, name: indexName, unique: true })
                        .then((err) => {
                            if (err) {
                                self.ctx.logError(err, `MONGODB: Error when creating index for ${this.state.uri} for schema ${schema.name}`);
                            }
                            else {
                                self._logger.info(self.ctx, `MONGODB: Unique index created for ${this.state.uri} for schema ${schema.name}`);
                            }
                        })
                        .catch(err => {
                            self.ctx.logError(err, `MONGODB: Error when creating index for ${this.state.uri} for schema ${schema.name}`);
                        });
                }
                resolve(self.state);
            });
        });
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAllAsync(schema: Schema, options: ListOptions): Promise<Array<any>> {
        let page = options.page || 0;
        let maxByPage = options.maxByPage || 100;
        let query = options.query ? options.query.filter || options.query : {};

        this.ctx.logVerbose(`MONGODB: Get all on ${this.state.uri} for schema ${schema.name} with query: ${JSON.stringify(query)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                let cursor = db.collection(schema.description.storageName).find(query)
                    .skip(page * maxByPage)
                    .limit(maxByPage);
                cursor.toArray((err, res) => {
                    if (err) {
                        this.ctx.logError(err, `Error when getting all entities for schema: ${schema.name}`);
                        reject(err);
                    }
                    else
                        resolve(res);
                });
            }
            catch (err) {
                this.ctx.logError(err, `Error when getting all entities for schema: ${schema.name}`);
                reject(err);
            }
        });
    }

    findOneAsync(schema: Schema, query) {
        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                db.collection(schema.description.storageName).findOne(query,
                    (err, res) => {
                        if (err) {
                            this.ctx.logError(err, `Error when find one entity for schema: ${schema.name}`);
                            reject(err);
                        }
                        else
                            resolve(res);
                    });
            }
            catch (err) {
                this.ctx.logError(err, `Error when find one entity for schema: ${schema.name}`);
                reject(err);
            }
        });
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    getAsync(schema: Schema, name: string) {
        this.ctx.logVerbose(`MONGODB: Get on ${this.state.uri} for schema ${schema.name} with id: ${name}`);

        return new Promise(async (resolve, reject) => {
            try {
                let filter = {};
                filter[this.state.keyPropertyName || "_id"] = name;
                let db = this.state._mongo;
                db.collection(schema.description.storageName).findOne(filter, (err, res) => {
                    if (err) {
                        this.ctx.logError(err, `Error when getting entity ${name}, schema: ${schema.name}`);
                        reject(this.normalizeErrors(name, err));
                    }
                    else
                        resolve(res);
                });
            }
            catch (err) {
                this.ctx.logError(err, `Error when getting entity ${name}, schema: ${schema.name}`);
                reject(err);
            }
        });
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    deleteAsync(schema: Schema, old: string | any) {
        if (!old)
            throw new Error("Argument is required");

        return new Promise(async (resolve, reject) => {
            let id;
            if (typeof old === "string")
                id = old;
            else
                id = old[this.state.keyPropertyName];
            if (!id)
                throw new Error("Mongo : Error on delete. Id must not be null");

            try {
                let filter = {};
                filter[this.state.keyPropertyName || "_id"] = id;
                this.ctx.logVerbose(`MONGODB: Deleting on ${this.state.uri} for schema ${schema.name} with filter: ${JSON.stringify(filter)}`);

                let db = this.state._mongo;
                db.collection(schema.description.storageName).remove(filter, (err, res) => {
                    if (err) {
                        this.ctx.logError(err, `Error when deleting entity ${id}, schema: ${schema.name}`);
                        reject(this.normalizeErrors(id, err));
                    }
                    else
                        resolve();
                });
            }
            catch (err) {
                this.ctx.logError(err, `Error when deleting entity ${id}, schema: ${schema.name}`);
                reject(err);
            }
        });
    }

    private normalizeErrors(id: string, err) {
        if (!err || !err.errors) return err;
        let error = new ApplicationRequestError("Mongo error", []);
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
    createAsync(schema: Schema, entity) {
        if (!entity)
            throw new Error("Entity is required");

        entity._created = new Date().toUTCString();

        this.ctx.logVerbose(`MONGODB: Create entity on ${this.state.uri} for schema ${schema.name} with entity: ${JSON.stringify(entity)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let db = this.state._mongo;
                db.collection(schema.description.storageName).insertOne(entity, (err) => {
                    if (err) {
                        let id = entity[this.state.keyPropertyName];
                        this.ctx.logError(err, `Error when creating entity ${id}, schema: ${schema.name}`);
                        reject(this.normalizeErrors(entity[this.state.keyPropertyName], err));
                    }
                    else {
                        resolve(entity);
                    }
                });
            }
            catch (err) {
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
    updateAsync(schema: Schema, entity, old) {
        if (!entity)
            throw new Error("Entity is required");

        this.ctx.logVerbose(`MONGODB: Update entity on ${this.state.uri} for schema ${schema.name} with entity: ${JSON.stringify(entity)}`);

        return new Promise(async (resolve, reject) => {
            try {
                let id = (old || entity)[this.state.keyPropertyName];
                let filter = {};
                filter[this.state.keyPropertyName || "_id"] = id;
                let db = this.state._mongo;
                let collection = db.collection(schema.description.storageName);

                collection.findOne(filter, (err, initial) => {
                    if (err) {
                        this.ctx.logError(err, `Error when updating entity ${id}, schema: ${schema.name}`);
                        reject(new Error(`Error when updating entity ${id}, schema: ${schema.name}, error: ${err.message}`));
                        return;
                    }
                    if (!initial) {
                        err = new Error(`Can not update unknow entity ${id}, schema: ${schema.name}`);
                        this.ctx.logError(err, `Error when updating entity ${id}, schema: ${schema.name}`);
                        reject();
                        return;
                    }

                    let _id = initial._id;
                    initial = schema.deepAssign(initial, entity);
                    initial._updated = new Date().toUTCString();
                    initial._id = _id;

                    collection.updateOne(filter, initial, err => {
                        if (err) {
                            this.ctx.logError(err, `Error when updating entity ${id}, schema: ${schema.name}`);
                            reject(this.normalizeErrors(id, err));
                        }
                        else
                            resolve(initial);
                    });
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
