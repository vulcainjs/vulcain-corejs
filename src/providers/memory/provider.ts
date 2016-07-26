import * as fs from 'fs'
import {IProvider, ListOptions} from "../provider";
import {Schema} from "../../schemas/schema";
import {Inject} from '../../di/annotations';
/**
 * Default memory provider
 */
export class MemoryProvider implements IProvider<any>
{
    private _data: any = {};
    private _saveToFile: string;

    /**
     * Create a memory provider instance.
     * @param dataFolder : (optional) if provided, data will be persisted on disk on EVERY create, update or delete
     */
    constructor(private dataFolder?: string) {
    }

    initializeWithSchema(schema: Schema) {

        if (!schema)
            throw new Error("Schema can not be null");

        if (this.dataFolder) {
            // console.log("Create memory provider for " + schema.name);
            if (!fs.existsSync(this.dataFolder))
                fs.mkdirSync(this.dataFolder);

            this._saveToFile = this.dataFolder + "/" + schema.description.storageName + ".json";

            if (fs.existsSync(this._saveToFile)) {
                this._data = JSON.parse(fs.readFileSync(this._saveToFile, "UTF-8"));
            }
        }
    }

    private save(schema: Schema) {
        if (!this._saveToFile) return;
        fs.writeFileSync(this._saveToFile, JSON.stringify(this._data), "UTF-8")
    }

    static clone(obj) {
        return obj && Object.assign({}, obj);
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAllAsync(schema: Schema, options: ListOptions): Promise<Array<any>> {
        options = options || { maxByPage: -1 };
        return new Promise((resolve, reject) => {
            try {
                let result = Array.from(this.take(schema, this._data[schema.description.storageName], options));
                options.length = result.length;
                resolve(result);
            }
            catch (err) {
                reject(err);
            }
        }
        );
    }


    public *take(schema: Schema, list, options: ListOptions) {
        let self = this;
        let take = options.maxByPage || -1;
        let skip = take * (options.page || 0);
        let cx = 0;
        if (list) {
            for (let k in list) {
                let v = list[k];
                if (!v || options.query && !self.filter(schema, v, options.query)) continue;

                if (cx < skip) { cx++; continue; }
                if (take < 0 || cx < skip + take) {
                    cx++;
                    yield MemoryProvider.clone(v);
                }
                else
                    break;
            }
        }
    }

    private filter(schema: Schema, elem, config, flag?: boolean) {
        flag = !!flag;
        let metadata = schema;
        for (var field in config) {
            if (!config.hasOwnProperty(field))
                continue;

            var val;
            var data = config[field];
            switch (field) {
                case "$schema":
                    val = metadata.name;
                    break;
                // case "$filter":
                //     if( data( elem ) === flag )
                //         return flag;
                //     break;
                case "$or":
                    if (this.filter(elem, data, true) === flag)
                        return flag;
                    break;
                case "_id":
                    val = metadata.getId(elem);
                    break;
                default:
                    if (field[0] == '$')
                        continue;
                    val = elem[field];
            }

            var r = !flag;
            if (data instanceof RegExp) {
                r = data.test(val);
            }
            else if (typeof (data) === "object") {
                r = this.evalExpression(val, data);
            }
            else {
                r = val === data;
            }

            if (r === flag)
                return flag;

        }

        return !flag;
    }

    private evalExpression(val, query): boolean {
        for (var op in query) {
            if (!query.hasOwnProperty(op)) continue;

            var lit = query[op];
            switch (op) {
                case "$eq":
                    if (val === lit) continue;
                    return false;
                case "$lt":
                    if (val < lit) continue;
                    return false;
                case "$gt":
                    if (val > lit) continue;
                    return false;
                case "$le":
                    if (val <= lit) continue;
                    return false;
                case "$ge":
                    if (val >= lit) continue;
                    return false;
                case "$ne":
                    if (val !== lit) continue;
                    return false;
                case "$in":
                    if (lit.indexOf(val) >= 0) continue;
                    return false;
                case "$startsWith":
                    if ((<string>val).startsWith(lit)) continue;
                    return false;
                default:
                    throw new Error("Operator not implemented");
            }
        }
        return true;
    }

    async findOneAsync(schema: Schema, query) {
        let options = <ListOptions>{};
        options.query = query;
        let list = await this.getAllAsync(schema, options);
        return list && list.length > 0 ? list[0] : null;
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    getAsync(schema: Schema, name: string) {
        var self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = self._data[schema.description.storageName];
                resolve(list && MemoryProvider.clone(list[name] || []));
            }
            catch (err) {
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

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let id;
                if (typeof old === "string")
                    id = old;
                else
                    id = schema.getId(old);

                let list = self._data[schema.description.storageName];
                if (list && list[id]) {
                    delete list[id];
                    self.save(schema);
                    resolve(true);
                }
                else {
                    resolve(false);
                }
            }
            catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Persist an entity
     * @param entity
     * @returns {Promise}
     */
    createAsync(schema: Schema, entity) {
        if (!entity)
            throw new Error("Entity is required");

        var self = this;
        entity._created = new Date().toUTCString();

        return new Promise((resolve, reject) => {
            try {
                let list = self._data[schema.description.storageName];
                if (!list) {
                    list = {};
                    self._data[schema.description.storageName] = list;
                }
                let name = schema.getId(entity);
                if (!name)
                    throw new Error(`Can not create an ${schema.name} entity with undefined ${schema.getIdProperty()} `);

                if (list[name]) {
                    reject(new Error("Can not add existing entity " + name));
                    return;
                }
                list[name] = MemoryProvider.clone(entity);
                self.save(schema);
                resolve(entity);
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

        entity._updated = new Date().toUTCString();

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = self._data[schema.description.storageName];
                let name = schema.getId(entity);
                if (!list || !list[name]) {
                    reject("Entity doesn't exist. " + name);
                    return;
                }
                list[name] = MemoryProvider.clone(entity);
                self.save(schema);
                resolve(entity);
            }
            catch (err) {
                reject(err);
            }
        }
        );
    }
}
