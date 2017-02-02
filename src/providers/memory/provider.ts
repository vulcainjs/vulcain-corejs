import * as fs from 'fs';
import { IProvider, ListOptions } from "../provider";
import { Schema } from "../../schemas/schema";
import { MongoQueryParser } from './mongoQueryParser';
import { DefaultServiceNames } from '../../di/annotations';
import { SchemaBuilder } from '../../schemas/schemaBuilder';
import { RequestContext } from '../../servers/requestContext';
import { Conventions } from '../../utils/conventions';

interface AstNode {
    op: string;
    left?: AstNode | any;
    right?: AstNode | any;
}

interface ISchemaData {
    data?: any;
    saveToFile?: string;
}
/**
 * Default memory provider
 */
export class MemoryProvider implements IProvider<any>
{
    private state: {
        schemas: Map<string, ISchemaData>,
        folder: string;
    };

    get address() {
        return "memory";
    }

    /**
     * Create a memory provider instance.
     * @param dataFolder : (optional) if provided, data will be persisted on disk on EVERY create, update or delete
     */
    constructor(private dataFolder?: string) {
    }

    initializeTenantAsync(context: RequestContext, tenant: string) {

        if (!tenant)
            throw new Error("Tenant can not be null");

        let folder = this.dataFolder;
        if (this.dataFolder) {
            if (!fs.existsSync(folder))
                fs.mkdirSync(folder);

            folder = folder + '/' + tenant;
            if (!fs.existsSync(folder))
                fs.mkdirSync(folder);
        }
        this.state = { schemas: new Map<string, ISchemaData>(), folder };

        return Promise.resolve(() => { this.state = null; });
    }

    private ensureSchema(schema: Schema) {
        let schemaInfo = this.state.schemas.get(schema.name);
        if (!schemaInfo) {
            schemaInfo = { data: {} };
            if (this.state.folder) {
                schemaInfo.saveToFile = this.state.folder + "/" + schema.description.storageName + ".json";
                if (fs.existsSync(schemaInfo.saveToFile)) {
                    schemaInfo.data = JSON.parse(fs.readFileSync(schemaInfo.saveToFile, "UTF-8"));
                }
            }

            this.state.schemas.set(schema.name, schemaInfo);
        }
        return schemaInfo.data;
    }

    private save(schema: Schema) {
        let schemaInfo = this.state.schemas.get(schema.name);

        if (!schemaInfo.saveToFile) return;
        fs.writeFileSync(schemaInfo.saveToFile, JSON.stringify(schemaInfo.data), "UTF-8");
    }


    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAllAsync(schema: Schema, options: ListOptions): Promise<Array<any>> {
        let data = this.ensureSchema(schema);

        options = options || { maxByPage: -1 };
        return new Promise((resolve, reject) => {
            try {
                let result = Array.from(this.take(schema, data[schema.description.storageName], options));
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
        let take = options.maxByPage || -1;
        let skip = take * (options.page || 0);
        let cx = 0;
        let query = new MongoQueryParser(options.query.filter || options.query);
        if (list) {
            for (let k in list) {
                let v = list[k];
                if (!v || !query.execute(v)) continue;
                if (cx < skip) { cx++; continue; }
                if (take < 0 || cx < skip + take) {
                    cx++;
                    yield Conventions.clone(v);
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
        let data = this.ensureSchema(schema);

        const self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = data[schema.description.storageName];
                resolve(list && Conventions.clone(list[name]));
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
        let data = this.ensureSchema(schema);

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let id;
                if (typeof old === "string")
                    id = old;
                else
                    id = schema.getId(old);

                let list = data[schema.description.storageName];
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
        let data = this.ensureSchema(schema);

        const self = this;
        entity._created = new Date().toUTCString();

        return new Promise((resolve, reject) => {
            try {
                let list = data[schema.description.storageName];
                if (!list) {
                    list = {};
                    data[schema.description.storageName] = list;
                }
                let name = schema.getId(entity);
                if (!name)
                    throw new Error(`Can not create a ${schema.name} entity with undefined id ${schema.getIdProperty()} `);

                if (list[name]) {
                    reject(new Error(`Can not add existing ${schema.name} ${name}`));
                    return;
                }

                list[name] = Conventions.clone(entity);
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
        let data = this.ensureSchema(schema);

        entity._updated = new Date().toUTCString();

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = data[schema.description.storageName];
                let name = schema.getId(entity);
                if (!list || !list[name]) {
                    reject("Entity doesn't exist. " + name);
                    return;
                }

                entity = schema.deepAssign(list[name], entity);
                list[name] = Conventions.clone(entity);
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
