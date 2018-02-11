import { Preloader } from '../preloader';
import 'reflect-metadata';

const sym = Symbol.for("vulcain:metadata");

export class Reflector {

    static getInheritedMetadata(key, target) {
        let metadata;
        if (target) {
            metadata = {
                ...Reflector.getInheritedMetadata(key, Object.getPrototypeOf(target)),
                ...Reflect.getOwnMetadata(key, target)
            };
            
            if(target.prototype) {
                metadata = { ...metadata, ...Reflect.getOwnMetadata(key, target.prototype) };
            }
        }
        return metadata || {};
    }

    static getMetadata(target, key?) {
        return key
            ? Reflect.getOwnMetadata(sym, target.prototype, key) || {}
            : Reflector.getInheritedMetadata(sym, target);
    }
}

export function Metadata<T=any>(name: string, metadata: T) {
    return (target, key?) => {
        let metadatas = Reflect.getOwnMetadata(sym, target, key) || {};
        metadatas[name] = metadata;
        Reflect.defineMetadata(sym, metadatas, target, key);
    };
}