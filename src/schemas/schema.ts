import {Injectable, LifeTime} from '../di/annotations';
import {SchemaBuilder} from './schemaBuilder'
import {standards} from './standards'
import {Validator} from './validator'
import {IContainer} from '../di/resolvers';

/**
 * Schema definition
 */
export class Schema {
    public description;
    private _domain:Domain;

    /**
     * Current domain model
     * @returns {Domain}
     */
    public get domain() :Domain {
        return this._domain;
    }

    get extends()
    {
        if( !this.description.extends ) return null;
        if( typeof this.description.extends === "string" )
        {
            return this._domain.findSchemaDescription( this.description.extends );
        }
        else
        {
            return this.description.extends;
        }
    }
    /**
     * Create a new schema
     * @param domain : current domain model
     * @param name : schema name or schema
     */
    constructor(domain: Domain, public name: string) {
        this._domain = domain;

        this.description = domain.findSchemaDescription(name);
        if (this.description)
            name = this.description.name;
        if (this.description == null) throw new Error(`Schema ${name} not found.`);
    }

    /**
     *
     * @param origin
     * @returns {null|any|{}}
     */
    bind(origin, old?)  {
        return this.domain.bind(origin, this, old);
    }

    validate(obj) {
        return this.domain.validate(obj, this.description);
    }

    getIdProperty() {
        return this.domain.getIdProperty(this.description);
    }

    getId(obj) {
        return obj[this.getIdProperty()];
    }

    apply(methodName: string, ...obj) {
        return this.domain.apply(methodName, this, obj);
    }

    decrypt(obj) {
        return this.domain.apply("decrypt", this, [obj]);
    }
}

/**
 * Domain model
 */
export class Domain
{
    private _schemaDescriptions:Map<string, any>;
    private types:Map<string, any>;

    constructor(public name:string, private container: IContainer, defaultTypes?, private throwErrorOnInvalidType?:boolean )
    {
        this._schemaDescriptions = new Map<string,any>();
        this.types    = new Map<string,any>();
        this.types.set( "", defaultTypes || standards );
    }

    addSchemaDescription( schema, name?:string ):string
    {
        let schemaName = null;
        if( Array.isArray( schema ) )
        {
            schema.forEach( s=>
                {
                    let tmp = this.addSchemaDescription( s );
                    if( !schemaName ) schemaName = tmp;
                }
            );
            return schemaName;
        }
        if( !schema ) throw new Error("Invalid schema argument");

        if (typeof schema === "function") {
            let tmp = this._schemaDescriptions.get(schema.name);
            if (tmp)
                return schema.name;

            schema = SchemaBuilder.build(schema);
        }

        schemaName = name || schema.name;
        if( !schemaName ) return;
        // Existing Model extension
        if(schema.extends === schema.name) {
            throw new Error("Invalid schema extension. Can not be the same schema.")
        }
        this._schemaDescriptions.set( schemaName, schema );
        return schemaName;
    }

    getSchema( name:string|Function )
    {
        if( typeof name === "string")
            return new Schema(this, name);
        return new Schema(this, this.addSchemaDescription(name));
    }

    get schemas()
    {
        return Array.from( this._schemaDescriptions.values() );
    }

    findSchemaDescription( name:string )
    {
        return this._schemaDescriptions.get( name );
    }

    get schemaDescriptions()
    {
        return Array.from( this._schemaDescriptions.values() );
    }

    addTypes( types, ns:string="" )
    {
        if (!types) throw new Error("Invalid type argument");
        let old = this.types.get(ns);
        Object.assign(old || {}, types);
        this.types.set( ns, old );
    }

    addType( type, ns?:string )
    {
        if( !type || !type.name ) throw new Error("Invalid type argument");
        let types = this.types.get(ns) || {};
        types.set[type.name] = type;
        this.types.set( ns, types );
    }

    private findMethodInTypeHierarchy( name:string, schema )
    {
        if( !schema ) return null;
        if( schema[name] || schema[name] === false ) return schema[name];
        let stype = schema.type;
        let parent = this._findType( stype );
        return this.findMethodInTypeHierarchy( name, parent );
    }

    _findType(name:string) {
        if(!name) return null;
        let parts = name.split('.');
        if(parts.length === 1)
            return this.types.get("")[name];
        if( parts.length != 2)
            throw new Error("Incorrect type name " + name);
        return this.types.get(parts[0])[parts[1]];
    }

    apply(methodName: string, schemaName, args:Array<any>) {
        let entity = args && args[0];
        if (!entity) return null;

        args.splice(0, 1);
        let schema = schemaName;

        if (typeof schemaName === "string") {
            schemaName = schemaName || entity && (<any>entity).__schema;
            schema = this._schemaDescriptions.get(schemaName);
            if (!schema) return;
        }
        else {
            if (!schema) return;
            schema = schema.description || schema;
        }

        if (typeof schema[methodName] === "function")
            entity = schema[methodName].apply(schema, [entity].concat(args)) || entity;

        for( const ps in schema.properties )
        {
            if( !schema.properties.hasOwnProperty( ps ) ) continue;
            let prop = schema.properties[ps];
            if( prop )
            {
                try
                {
                    let method = this.findMethodInTypeHierarchy( methodName, prop );
                    if (!method || typeof method !== "function") continue;
                    let val = entity[ps];
                    entity[ps] = val && method.apply(prop, [entity[ps], entity].concat(args)) || val;
                }
                catch( e )
                {
                    // ignore
                }
            }
        }

        for (const ref in schema.references) {
            if (!schema.references.hasOwnProperty(ref)) continue;
            let relationshipSchema = schema.references[ref];
            let refValue = entity[ref];
            if (relationshipSchema && refValue) {
                try {
                    let item = relationshipSchema.item;
                    if (item === "any" && refValue && refValue.__schema) {
                        item = refValue.__schema;
                    }
                    let elemSchema = this.findSchemaDescription(item);
                    if (!elemSchema && item !== "any") {
                        continue;
                    }

                    let method = this.findMethodInTypeHierarchy(methodName, elemSchema);
                    if (this.isMany(relationshipSchema)) {
                        for (let elem of refValue) {
                            if (method && typeof method === "function")
                                method.apply(elemSchema, [elem].concat(args));
                            else
                                this.apply(methodName, elemSchema, [elem].concat(args));
                        }
                    }
                    else {
                        if (method && typeof method === "function")
                            method.apply(elemSchema, [refValue].concat(args));
                        else
                            this.apply(methodName, elemSchema, [refValue].concat(args));
                    }
                }
                catch (e) {
                    // ignore
                }
            }
        }
        if (schema.extends) {
            this.apply(methodName, schema.extends, entity);
        }
    }

    /**
     * Convert a new object from an other based on a specific schema
     * @param origin : initial object to convert
     * @param schemaName : schema to used (default=current schema)
     * @param obj : existing object to use
     * @returns {any}
     */
    bind( origin, schemaName?:string|any, obj? )
    {
        if( !origin ) return null;
        let schema = schemaName;

        if( typeof schemaName === "string" )
        {
            schemaName = schemaName || obj && (<any>obj).__schema;
            schema     = this._schemaDescriptions.get( schemaName );
            if( !schema ) throw new Error("Unknow schema " + schemaName);
        }
        else
        {
            if( !schema ) throw new Error("Invalid schema");
            schema = schema.description || schema;
            schemaName = schema.name;
        }

        if( typeof schema.bind == "function" )
        {
            obj = schema.bind( origin );
        }

        obj                = obj || origin;
        if (typeof obj !== "object")
            return obj;
        
        (<any>obj).__schema = (<any>obj).__schema || schemaName;

        // Convert properties
        for( const ps in schema.properties )
        {
            if( !schema.properties.hasOwnProperty( ps ) ) continue;
            let prop = schema.properties[ps];
            if( prop )
            {
                try
                {
                    let convert = this.findMethodInTypeHierarchy( "bind", prop );
                    if( convert === false ) continue;
                    let val = convert && typeof convert === "function" && convert.apply( prop, [origin[ps], origin] ) || origin[ps];
                    if( val !== undefined )
                    {
                        obj[ps] = val;
                        // obj.isModified[ps] = true;
                    }
                }
                catch( e )
                {
                    // ignore
                }
            }
        }

        for( const ref in schema.references )
        {
            if( !schema.references.hasOwnProperty( ref ) ) continue;
            let relationshipSchema = schema.references[ref];
            let refValue = origin[ref];
            if( relationshipSchema && refValue )
            {
                try
                {
                    let item = relationshipSchema.item;
                    if( item === "any" && refValue && refValue.__schema) {
                        item = refValue.__schema;
                    }
                    let elemSchema = this.findSchemaDescription( item );
                    if( !elemSchema && item !== "any")
                    {
                        continue;
                    }

                    let bind = this.findMethodInTypeHierarchy( "bind", relationshipSchema );
                    if( bind === false ) continue;
                    if( this.isMany( relationshipSchema ) )
                    {
                        obj[ref] = [];
                        for( let elem of refValue )
                        {
                            obj[ref].push(bind && typeof bind === "function" && bind.apply(relationshipSchema, [elem]) ||
                                !elemSchema && item === "any" ? elem : this.bind(elem, elemSchema));
                        }
                    }
                    else
                    {
                        obj[ref] = bind && typeof bind === "function" && bind.apply(relationshipSchema, [refValue]) ||
                            !elemSchema && item === "any" ? refValue : this.bind(refValue, elemSchema);
                    }
                }
                catch( e )
                {
                    // ignore
                }
            }
        }
        if( schema.extends )
        {
            this.bind( origin, schema.extends, obj );
        }
        return obj;
    }


    private isMany( relSchema )
    {
        return relSchema.cardinality === "many";
    }

    /**
     * Validate an object
     * @param val : Object to validate
     * @param schemaName : schema to use (default=current schema)
     * @returns Array<string> : A list of errors
     */
    validate(val, schemaName?:string|any) {
        if(!val) return [];
        let schema = schemaName;

        if(typeof schemaName === "string") {
            schemaName = schemaName || val && val.__schema;
            schema = this._schemaDescriptions.get(schemaName);
            if(!schema) throw new Error("Unknown schema " + schemaName);
        }
        else {
            if (!schema) throw new Error("Invalid schema");
            schema = schema.description || schema;
        }

        var validator = new Validator(this, this.container, this.throwErrorOnInvalidType);
        return validator.validate(schema,val);
    }

    getIdProperty(schemaName?:string|any) {
        let schema = schemaName;

        if(typeof schemaName === "string") {
            schemaName = schemaName;
            schema = this._schemaDescriptions.get(schemaName);
            if(!schema) throw new Error("Unknown schema " + schemaName);
        }
        else {
            if(!schema) throw new Error("Invalid schema");
        }

        return schema.idProperty;
    }
}
