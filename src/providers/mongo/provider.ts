// <reference path="../../../../typings/mongoose/mongoose.d.ts"/>

import {IProvider, ListOptions} from "../provider";
import {Schema} from "../../schemas/schema";
import {MongoClient, Db, Cursor} from 'mongodb';
import {Inject} from '../../di/annotations';
import {Logger} from 'vulcain-configurationsjs'
/**
 * Default mongo provider
 */
export class MongoProvider implements IProvider<any>
{
    private  _mongo;
    private _keyPropertyName:string;

    constructor( @Inject("Logger") private _logger: Logger, private uri: string, private options?) {
    }

    initializeWithSchema(schema:Schema) {
        if (!schema)
            throw new Error("Schema is not set for the current provider.");

        this._keyPropertyName = schema.getIdProperty();
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
        if (keys) {
            this.ensuresDbOpen()
                .then(db => {
                    let indexName = schema.description.storageName + "_uniqueIndex";
                    db.createIndex(schema.name, keys,{ w: 1, background: true, name: indexName, unique: true })
                        .catch(err => {
                            this._logger.log(err);
                        });
                })
                .catch(err => {
                    this._logger.log(err);
                });
        }
    }

    private ensuresDbOpen(): Promise<Db> {

        let self = this;
        return new Promise((resolve, reject) => {
            if (!self._mongo) {
                MongoClient.connect(self.uri, self.options, (err, db) => {
                    if (err)
                        reject(err);
                    else
                    {
                        self._mongo = db;
                        resolve(db);
                    }
                });
            }
            else
                resolve(self._mongo);
        });
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAllAsync( schema:Schema, options:ListOptions ) : Promise<Array<any>>
    {
        return new Promise( async ( resolve, reject ) =>
            {
                try
                {
                    let db = await this.ensuresDbOpen();
                    let cursor = db.collection(schema.description.storageName).find(options.query.filter || options.query, null, options.page, options.maxByPage);
                    cursor.toArray((err, res) => {
                        if(err)
                            reject(err);
                        else
                            resolve(res);
                    });
                }
                catch( err )
                {
                    reject( err );
                }
            }
        );
    }

    findOneAsync(schema:Schema, query) {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(schema.description.storageName).findOne(query,
                    (err, res) => {
                        if (err)
                            reject(err);
                        else
                            resolve(res);
                    });
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    getAsync( schema:Schema, name:string )
    {
        var self = this;
        return new Promise( async ( resolve, reject ) =>
        {
            try
            {
                let filter = {};
                filter[this._keyPropertyName|| "_id"] = name;
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(schema.description.storageName).findOne(filter, (err, res) => {
                    if(err)
                        reject(err);
                    else
                        resolve(res);
                });
            }
            catch(err) {
                reject(err);
            }
        } );
    }

    /**
     * Delete an entity
     * @param id
     * @returns {Promise}
     */
    deleteAsync( schema:Schema, old: string|any )
    {
        if (!old)
            throw new Error("Argument is required");

        let self = this;
        return new Promise( async ( resolve, reject ) =>
        {
            try
            {
                let id;
                if (typeof old === "string")
                    id = old;
                else
                    id = old[this._keyPropertyName];
                let filter = {};
                filter[this._keyPropertyName|| "_id"] = id;
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(schema.description.storageName).remove(filter, (err, res) => {
                    if(err)
                        reject(this.normalizeErrors(id, err));
                    else
                        resolve();
                });
            }
            catch(err)
            {
                reject(err);
            }
        } );
    }

    private normalizeErrors(id:string, err) {
        if(!err || !err.errors) return err;
        let errors = {message:"Validations errors", errors:[]}
        for (let e in err.errors) {
            if(!err.errors.hasOwnProperty(e)) continue;
            let error = err.errors[e];
            errors.errors.push({message:error.message, property:error.path, id:id});
        }
        return {code:400, body: errors};
    }

    /**
     * Persist an entity
     * @param entity
     * @returns {Promise}
     */
    createAsync(schema:Schema,  entity )
    {
        if (!entity)
            throw new Error("Entity is required");

        entity._created = new Date().toUTCString();
        return new Promise( async ( resolve, reject ) =>
        {
            try
            {
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(schema.description.storageName).insertOne(entity, (err) => {
                    if(err)
                        reject(this.normalizeErrors(entity[this._keyPropertyName], err));
                    else
                        resolve(entity);
                });
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
    updateAsync(schema:Schema, entity, old) {
        if (!entity)
            throw new Error("Entity is required");

        return new Promise(async (resolve, reject) => {
            try {
                let id = (old||entity)[this._keyPropertyName];
                let filter = {};
                filter[this._keyPropertyName||"_id"] = id;
                let db = await this.ensuresDbOpen();
                let collection = db.collection(schema.description.storageName);
                let cursor = collection.findOne(filter, (err, initial) => {
                    if(err || !initial) {
                        reject(err);
                        return;
                    }
                    initial = Object.assign(initial, entity);
                    initial._updated = new Date().toUTCString();

                    collection.updateOne(filter, initial, err =>
                    {
                        if (err)
                            reject(this.normalizeErrors(id, err));
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
