import * as fs from 'fs';
import { IProvider, QueryOptions } from "../provider";
import { Schema } from "../../schemas/schema";
import { MongoQueryParser } from './mongoQueryParser';
import { DefaultServiceNames } from '../../di/annotations';
import { Conventions } from '../../utils/conventions';
import { IRequestContext } from "../../pipeline/common";
import { ApplicationError } from '../../pipeline/errors/applicationRequestError';
import { QueryResult } from '../../pipeline/handlers/query/queryResult';

interface AstNode {
    op: string;
    left?: AstNode | any;
    right?: AstNode | any;
}

interface ISchemaData {
    data?: { count: number, entities: any };
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

    setTenant(tenant: string) {

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

        return () => { this.state = null; };
    }

    private ensureSchema(schema: Schema) {
        let schemaInfo = this.state.schemas.get(schema.name);
        if (!schemaInfo) {
            schemaInfo = { data: { entities: {}, count: 0 } };
            if (this.state.folder) {
                schemaInfo.saveToFile = this.state.folder + "/" + schema.info.storageName + ".json";
                if (fs.existsSync(schemaInfo.saveToFile)) {
                    schemaInfo.data = JSON.parse(fs.readFileSync(schemaInfo.saveToFile, "UTF-8"));
                }
            }

            this.state.schemas.set(schema.name, schemaInfo);
        }
        return schemaInfo;
    }

    private save(schema: Schema) {
        let schemaInfo = this.state.schemas.get(schema.name);

        if (!schemaInfo.saveToFile) return;
        fs.writeFileSync(schemaInfo.saveToFile, JSON.stringify(schemaInfo.data), { encoding: "UTF-8" });
    }

    /**
     * Return a list of entities
     * @param options
     * @returns {Promise}
     */
    getAll(schema: Schema, options: QueryOptions): Promise<QueryResult> {
        let data = this.ensureSchema(schema).data;

        options = options || { pageSize: -1 };
        return new Promise((resolve, reject) => {
            try {
                let result = MemoryProvider.Query(data.entities,
                    (options.query && options.query.filter) || options.query,
                    options.page,
                    options.pageSize);
                resolve(new QueryResult(result, data.count));
            }
            catch (err) {
                reject(err);
            }
        }
        );
    }

    static Query(list, query, page: number, pageSize: number, cloneResult=true) {
        return Array.from(MemoryProvider.take(MemoryProvider.filter(list, query, cloneResult), page, pageSize));
    }

    private static *filter(list, query, cloneResult) {
        let cx = 0;
        if (list) {
            const queryParser = new MongoQueryParser(query);
            for (let k in list) {
                let v = list[k];
                if (!v || !queryParser.execute(v)) continue;
                cx++;
                yield cloneResult ? Conventions.clone(v) : v;
            }
        }
    }

    private static *take(iterator: IterableIterator<any>, page: number, pageSize: number) {
        if (iterator) {
            let take = pageSize || -1;
            let skip = take * (page > 0 ? page-1 : 0 || 0);
            let cx = 0;
            for (let v of iterator) {
                if (cx < skip) { cx++; continue; }
                if (take < 0 || cx < skip + take) {
                    cx++;
                    yield v;
                }
                else
                    break;
            }
        }
    }

    /**
     * Read an entity
     * @param name
     * @returns {Promise}
     */
    get(schema: Schema, id: string) {
        let data = this.ensureSchema(schema).data;

        const self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = data.entities;
                resolve(list && Conventions.clone(list[id]));
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
    delete(schema: Schema, id: string | number) {
        if (!id)
            throw new Error("Id is required");
        
        let data = this.ensureSchema(schema).data;
        let self = this;
        return new Promise<boolean>((resolve, reject) => {
            try {
                let list = data.entities;
                if (list && list[id]) {
                    resolve(list[id]);
                    delete list[id];
                    data.count--;
                    self.save(schema);
                }
                else {
                    resolve(null);
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
    create(schema: Schema, entity) {
        if (!entity)
            throw new Error("Entity is required");
        let data = this.ensureSchema(schema).data;

        const self = this;
        entity._created = new Date().toUTCString();

        return new Promise((resolve, reject) => {
            try {
                let list = data.entities;
                let name = schema.getId(entity);
                if (!name)
                    throw new Error(`Can not create a ${schema.name} entity with undefined id : ${schema.getIdProperty()} `);

                if (list[name]) {
                    reject(new ApplicationError(`Can not add existing ${schema.name} ${name}`));
                    return;
                }

                list[name] = Conventions.clone(entity);
                data.count++;
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
     * @returns {Promise<T>}
     */
    update(schema: Schema, entity) {
        if (!entity)
            throw new Error("Entity is required");
        let data = this.ensureSchema(schema).data;

        entity._updated = new Date().toUTCString();

        let self = this;
        return new Promise((resolve, reject) => {
            try {
                let list = data.entities;
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
