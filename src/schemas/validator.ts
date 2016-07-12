
import {Domain, Schema} from './schema'

export class Validator
{

    constructor( private domain:Domain, private throwErrorOnInvalidType:boolean )
    {
    }

    validate( schema, val )
    {
        let errors = [];
        if( !schema || !val ) return errors;

        if( schema.extends )
        {
            let base = typeof schema.extends === "string" ? this.domain.getSchema(schema.extends) : schema.extends;
            if(base)
            {
                this.validate( base, val ).forEach(e=> {errors.push( e );});
            }
        }
        let id =  val && val[schema.idProperty];
        let ctx:FormatContext = { element: val, schemaElement: schema, id: id };

        // Properties checks
        for( const ps in schema.properties )
        {
            if( !schema.properties.hasOwnProperty( ps ) ) continue;
            ctx.propertyName   = ps;
            ctx.propertySchema = schema.properties[ps];
            ctx.propertyValue  = val[ps];

            try
            {
                let err = this.validateProperty( schema.properties[ps], val[ps], val);
                if( err )
                {
                    errors.push( {message: this.__formatMessage( err, ctx ), property:ps, id:ctx.id} );
                }
            }
            catch( e )
            {
                errors.push( {message:this.__formatMessage( "Validation error for property {$propertyName} : " + e, ctx ), id:ctx.id, property:ps} );
            }
        }

        // References checks
        for( const rs in schema.references )
        {
            if( !schema.references.hasOwnProperty( rs ) ) continue;
            ctx.propertyName   = rs;
            ctx.propertySchema = schema.references[rs];
            ctx.propertyValue  = val[rs];

            try
            {
                let ref = schema.references[rs];
                if( ref.item === "any" && ctx.propertyValue && ctx.propertyValue.__schema)
                {
                    if( ref && ref.dependsOn && !ref.dependsOn(val)) continue;
                    let schema = this.domain.getSchema( ctx.propertyValue.__schema );
                    if( !schema ) continue;
                    errors = errors.concat(this.validate( schema, ctx.propertyValue ));
                }
                else
                {
                    let errors2 = this.validateReference( ref, val[rs], val );
                    errors2.forEach( err=>errors.push( {message:this.__formatMessage( err, ctx ), id:ctx.id, PropertyDecorator:rs} ));
                }
            }
            catch( e )
            {
                errors.push( {message:this.__formatMessage( "Validation error for reference {$propertyName} : " + e, ctx ), id:ctx.id, PropertyDecorator:rs} );
            }
        }

        // Entity check
        if( schema.check )
        {
            ctx.propertyName = ctx.propertySchema = ctx.propertyValue = null;
            try
            {
                let err = schema.check( val );
                if( err )
                    errors.push( {message:this.__formatMessage( err, ctx ), id:ctx.id} );
            }
            catch( e )
            {
                errors.push( {message:this.__formatMessage( "Validation error for element {__schema} : " + e, ctx ), id:ctx.id} );
            }
        }
        return errors;
    }

    private clone( schema, from )
    {
        let clone = {};
        for( let p in schema )
        {
            if( !schema.hasOwnProperty( p ) ) continue;
            if( p && p[0] === "$" )
            {
                let pname = p.substr(1);
                clone[p] = (from.meta && from.meta[pname]) || from[pname] || schema[p];
            }
            else
            {
                clone[p] = schema[p];
            }
        }
        return clone;
    }

    private validateReference( schema, val, entity )
    {
        let errors = [];
        if (!schema)
            return errors;
        if (schema.dependsOn && !schema.dependsOn(entity))
            return errors;
        if (schema.type) {
            let type = this.domain._findType(schema.type);
            if (!type) {
                if( this.throwErrorOnInvalidType)
                    errors.push(`Unknown reference type ${schema.type} in schema ${schema.name}`);
            }
            else {
                errors = this.validateReference(this.clone(type, schema), val, entity);
            }
            if (errors.length > 0)
                return errors;
        }
        else {
            let type = this.domain._findType("$ref");
            if (type && type.check) {
                let clone:any = this.clone(type, schema);
                let err = clone.check(val);
                if (err) {
                    errors.push(err);
                    return errors;
                }
            }
        }
        if (schema.check) {
            let err = schema.check(val);
            if (err) {
                errors.push(err);
                return errors;
            }
        }
        let item = this.domain._findType(schema.item);
        if (!item) {
            if (this.throwErrorOnInvalidType)
                errors.push(`Unknown schema ${schema} for reference {$propertyName}`);
        }
        else {
            errors = this.validate(item, val);
        }
        return errors;
    }

    private validateProperty( schema:string | any, val, entity )
    {
        if( typeof schema === "string" )
        {
            let type = this.domain._findType( schema );
            if( !type ) return this.throwErrorOnInvalidType ? `Unknown schema ${schema}` : null;
            schema = type;
        }

        if( schema.dependsOn && !schema.dependsOn(entity)) return;

        let stype = schema.type;
        if( stype )
        {
            let type = this.domain._findType( stype );
            if( !type ) return this.throwErrorOnInvalidType ? `Unknown type ${stype} in schema ${schema.name}` : null;
            let err = this.validateProperty( this.clone( type, schema ), val, entity );
            if( err ) return err;
        }

        if( schema.check )
        {
            return schema.check( val );
        }
    }

    /**
     * Format an error message
     * @param message
     * @param ctx
     * @returns {string}
     * @private
     */
    private __formatMessage( message:string, ctx:FormatContext ):string
    {
        var regex = /{\s*([^}\s]*)\s*}/g;
        return message.replace( regex, function( match, name )
        {
            switch( name )
            {
                case "$value" :
                    return ctx.propertyValue;
                case "$schema":
                    return ctx.propertyName ? ctx.propertySchema : ctx.schemaElement;
                case "$id" :
                    return ctx.id;
                case "$propertyName" :
                    return ctx.propertyName;
                default :
                    if( !name ) return null;
                    let schema = ctx.propertyName ? ctx.propertySchema : ctx.schemaElement;
                    // Name beginning with $ belongs to schema
                    if( name[0] === "$" )
                    {
                        let p = schema[name] || schema[name.substring( 1 )];
                        return (typeof p === "function" && p( schema )) || p;
                    }
                    // Else it's an element's property
                    if( ctx.element )
                    {
                        let p = ctx.element[name];
                        return (typeof p === "function" && p( ctx.element )) || p;
                    }
                    return null;
            }
        } );
    }
}

interface FormatContext {
    id:string;
    element;
    schemaElement;
    propertyName?:string;
    propertySchema?;
    propertyValue?;
}
