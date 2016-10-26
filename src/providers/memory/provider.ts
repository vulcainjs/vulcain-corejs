import * as fs from 'fs'
import {IProvider, ListOptions} from "../provider";
import {Schema} from "../../schemas/schema";
import {MongoQueryParser} from './mongoQueryParser';

interface AstNode {
    op: string;
    left?: AstNode|any;
    right?: AstNode|any;
}

/**
 * Default memory provider
 */
export class MemoryProvider implements IProvider<any>
{
    public state: {
        data: any;
        saveToFile?: string;
    };

    /**
     * Create a memory provider instance.
     * @param dataFolder : (optional) if provided, data will be persisted on disk on EVERY create, update or delete
     */
    constructor(private dataFolder?: string) {
    }

    initializeWithSchema(tenant: string, schema: Schema) {

        if (!schema)
            throw new Error("Schema can not be null");

        this.state = { data: {} };

        if (this.dataFolder) {
            let folder = this.dataFolder;
            if (!fs.existsSync(folder))
                fs.mkdirSync(folder);

            folder = folder + '/' + tenant;
            if (!fs.existsSync(folder))
                fs.mkdirSync(folder);

            this.state.saveToFile = folder + "/" + schema.description.storageName + ".json";

            if (fs.existsSync(this.state.saveToFile)) {
                this.state.data = JSON.parse(fs.readFileSync(this.state.saveToFile, "UTF-8"));
            }
        }
        return this.state;
    }

    private save(schema: Schema) {
        if (!this.state.saveToFile) return;
        fs.writeFileSync(this.state.saveToFile, JSON.stringify(this.state.data), "UTF-8")
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
                let result = Array.from(this.take(schema, this.state.data[schema.description.storageName], options));
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
        let query = new MongoQueryParser(options.query.filter || options.query)
        if (list) {
            for (let k in list) {
                let v = list[k];
                if (!v || !query.execute(v)) continue;
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
                let list = self.state.data[schema.description.storageName];
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

                let list = self.state.data[schema.description.storageName];
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
                let list = self.state.data[schema.description.storageName];
                if (!list) {
                    list = {};
                    self.state.data[schema.description.storageName] = list;
                }
                let name = schema.getId(entity);
                if (!name)
                    throw new Error(`Can not create an ${schema.name} entity with undefined id ${schema.getIdProperty()} `);

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
                let list = self.state.data[schema.description.storageName];
                let name = schema.getId(entity);
                if (!list || !list[name]) {
                    reject("Entity doesn't exist. " + name);
                    return;
                }

                entity = Schema.deepAssign(list[name], entity);
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
