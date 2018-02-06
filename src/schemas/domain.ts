import { IContainer } from '../di/resolvers';
import { Schema } from "./schema";
import { Validator } from './validator';
import { IRequestContext } from "../pipeline/common";
import { ModelDefinition } from './builder/annotations.model';
import { ISchemaTypeDefinition, ISchemaValidation } from './schemaType';
import { Files } from '../utils/files';
import * as Path from 'path';
import { ApplicationError } from '..';

const scalarSymbol = Symbol("scalar");

/**
 * Domain model
 */
export class Domain {
    private _schemas: Map<string, Schema>;
    private static types: {[name:string]: ISchemaTypeDefinition} = {};

    constructor(public name: string, private container: IContainer) {
        this._schemas = new Map<string, Schema>();
        // Load standard types
        Files.traverse(Path.join(__dirname, "standards"));
    }

    /**
     * Declare a new type or validator
     */
    static addType(name: string, type: ISchemaTypeDefinition) {
        if (!name) { throw new Error("Invalid name argument"); }
        if (["array", "object", "void"].indexOf(name.toLowerCase()) >= 0) throw new Error("You can not create a type with the reserved name : " + name);
        Domain.types[name] = type;
        type.name = name;
    }

    getScalarTypeOf(source: ISchemaTypeDefinition | string): string {
        let type: ISchemaTypeDefinition;

        if (typeof source === "string") {
            type = source = this.getType(source);
        }
        else {
            type = source;
        }
        if (!source)
            return null;
        
        if (!source[scalarSymbol]) {
            // Cache resolved type
            let scalarType: string;
            while (type) {
                scalarType = type.scalarType;
                if (scalarType)
                    break;    
                type = this.getType(type.type);
            }
            if (!scalarType)
                scalarType = "any";
            
            source[scalarSymbol] = scalarType;
        }
        
        return source[scalarSymbol];
    }

    getType(name: string) {
        return (name && Domain.types[name]) || undefined;
    }

    addSchema(schema: Schema) {
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(schema.name))
            throw new ApplicationError(`Schema name ${schema.name}has invalid caracter. Must be '[a-zA-Z][a-zA-Z0-9]*'`);    
        this._schemas.set(schema.name, schema);
    }

    /**
     * Get a registered schema by name
     * Throws an exception if not exists
     * @param {string} schema name
     * @returns a schema
     */
    getSchema(name: string | Function, optional = false) {
        let schema: Schema;
        if (typeof name === "function") {
            name = name.name;
        }

        if (name) {
            schema = this._schemas.get(name);
        }

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
