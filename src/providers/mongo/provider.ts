// <reference path="../../../../typings/mongoose/mongoose.d.ts"/>

import {IProvider, ListOptions} from "../provider";
import {Schema} from "../../schemas/schema";
import {MongoClient, Db, Cursor} from 'mongodb';
import {Inject} from '../../di/annotations';
import {Logger} from '@sovinty/vulcain-configurations'
/**
 * Default mongo provider
 */
export class MongoProvider implements IProvider<any>
{
    private _schema:Schema;
    private  _mongo;
    private _keyPropertyName:string;

    /**
     * Create a memory provider instance.
     * @param dataFolder : (optional) if provided, data will be persisted on disk on EVERY create, update or delete
     */
    constructor( @Inject("Logger")private _logger:Logger, private uri:string, private options? )
    {
    }

    private ensuresSchema() {
        if (!this._schema)
            throw new Error("Schema is not set for the current provider.");
    }

    /**
     * Set schema to use
     * @param schema A valid schema
     */
    setSchema(schema: Schema) {
        if (!schema)
            throw new Error("Schema can not be null");

        this._keyPropertyName = schema.getIdProperty();
        this._schema = schema;
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
                    let indexName = this._schema.name + "_uniqueIndex";
                    db.createIndex(this._schema.name, keys,{ w: 1, background: true, name: indexName, unique: true })
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
        this.ensuresSchema();

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
    getAllAsync( options:ListOptions ) : Promise<Array<any>>
    {
        return new Promise( async ( resolve, reject ) =>
            {
                try
                {
                    let db = await this.ensuresDbOpen();
                    let cursor = db.collection(this._schema.name).find(options.query, null, options.page, options.limit);
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

    findOneAsync(query) {
        var self = this;
        return new Promise(async (resolve, reject) => {
            try {
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(this._schema.name).findOne(query,
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
    getAsync( name:string )
    {
        var self = this;
        return new Promise( async ( resolve, reject ) =>
        {
            try
            {
                let filter = {};
                filter[this._keyPropertyName|| "_id"] = name;
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(this._schema.name).findOne(filter, (err, res) => {
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
    deleteAsync( old: string|any )
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
                let cursor = db.collection(this._schema.name).remove(filter, (err, res) => {
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
    createAsync( entity )
    {
        if (!entity)
            throw new Error("Entity is required");

        entity._created = new Date().toUTCString();
        return new Promise( async ( resolve, reject ) =>
        {
            try
            {
                let db = await this.ensuresDbOpen();
                let cursor = db.collection(this._schema.name).insertOne(entity, (err) => {
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

    private applyChanges(initial, entity)
    {
        let schemaDescription = this._schema.description;
        for (let p in schemaDescription.properties) {
            if(!schemaDescription.properties.hasOwnProperty(p)) continue;
            let property = schemaDescription.properties[p];
            if (property.unique) {
                continue;
            }
            initial[p] = entity[p];
        }
        for (let r in schemaDescription.references)
        {
            if(!schemaDescription.references.hasOwnProperty(r)) continue;

            let reference = schemaDescription.references[r];
            if( reference.item === "any") {
                initial[r] = entity[r];
            }
            else {
                if(!entity[r] || !initial[r])
                    initial[r] = entity[r];
                else
                    this.applyChanges(initial[r], entity[r]);
            }
        }
    }

    /**
     * Update an entity
     * @param entity
     * @param old
     * @returns {Promise<T>}
     */
    updateAsync(entity, old) {
        if (!entity)
            throw new Error("Entity is required");

        return new Promise(async (resolve, reject) => {
            try {
                let id = (old||entity)[this._keyPropertyName];
                let filter = {};
                filter[this._keyPropertyName||"_id"] = id;
                let db = await this.ensuresDbOpen();
                let collection = db.collection(this._schema.name);
                let cursor = collection.findOne(filter, (err, initial) => {
                    if(err || !initial) {
                        reject(err);
                        return;
                    }
                    this.applyChanges(initial, entity);
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
