import { Preloader } from '../../preloader';
import 'reflect-metadata';
import { Domain } from '../domain';
import { SchemaBuilder } from './schemaBuilder';

/**
 * Define a new type to use with model property
 * @param name Type name (default to class name)
 */
export function SchemaTypeDefinition(name?:string) {
    return function (target: any) {
        Domain.addType(name || target.name, new target.prototype.constructor());
    };
}

export function Validator(name: string, options?) {
    return (target, key) => {
        const symValidators = Symbol.for("design:validators");
        let validators = Reflect.getOwnMetadata(symValidators, target, key) || [];
        validators.push({ name, options });
        Reflect.defineMetadata(symValidators, validators, target, key);
    };
}

