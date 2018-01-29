import { IContainer } from '../di/resolvers';
import { Schema } from "./schema";
import { Validator } from './validator';
import { IRequestContext } from "../pipeline/common";
import { ModelOptions } from './builder/annotations.model';
import { ISchemaTypeDefinition } from './schemaType';
import { Files } from '../utils/files';
import * as Path from 'path';

/**
 * Domain model
 */
export class Domain {
    private _schemas: Map<string, Schema>;
    private static types = {};

    constructor(public name: string, private container: IContainer) {
        this._schemas = new Map<string, Schema>();
        // Load standard types
        Files.traverse(Path.join(__dirname, "standards"));
    }

    static addType(name: string, type: ISchemaTypeDefinition) {
        if (!name) { throw new Error("Invalid argument"); }
        Domain.types[name] = type;
        type.name = name;
    }

    getBaseType(type) {
        if (!type.$$nativeSchema) {
            let stype = type;
            type.$$nativeSchema = stype.name
            while (stype && stype.type) {
                stype = stype.type;
                type.$$nativeSchema = stype.name;
                stype = Domain.types[stype];
            }
        }
        return type.$$nativeSchema;
    }

    getType(name: string) {
        return Domain.types[name];
    }

    addSchema(schema: Schema) {
        this._schemas.set(schema.name, schema);
    }

    /**
     * Get a registered schema by name
     * Throws an exception if not exists
     * @param {string} schema name
     * @returns a schema
     */
    getSchema(name: string, optional = false) {
        let schema = this._schemas.get(name);
        if (!schema) {
            if (optional) return null;
            throw new Error(`Schema ${name} not found.`);
        }
        return schema;
    }

    /**
     * Get all schemas
     *
     * @readonly
     */
    get schemas() {
        return Array.from(this._schemas.values());
    }

    /**
     * Validate an object
     * @param val : Object to validate
     * @param schemaName : schema to use (default=current schema)
     * @returns Array<string> : A list of errors
     */
    validate(ctx: IRequestContext, val, schemaName?: string | Schema) {
        if (!val) { return Promise.resolve(null); }
        let schema: Schema = this.getSchemaFromObject(schemaName, val);
        return schema.validate(ctx, val);
    }

    getSchemaFromObject(schemaName?: string | Schema, val?: any) {
        let schema: Schema;
        if (!schemaName || typeof schemaName === "string") {
            schemaName = schemaName && schemaName !== "any" ? schemaName : val && val.__schema;
            schema = schemaName && this._schemas.get(<string>schemaName);
            if (!schema) { throw new Error("Unknown schema " + schemaName); }
        }
        else {
            schema = schemaName;
            if (!schema) { throw new Error("Invalid schema"); }
        }
        return schema;
    }
}
