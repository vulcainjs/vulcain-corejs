import 'reflect-metadata';
import {Preloader} from '../preloader';

/**
 * List of default service names
 *
 * @export
 * @class DefaultServiceNames
 */
export class DefaultServiceNames
{
    static "Authentication" = "Authentication";
    static "Logger" = "Logger";
    static "Provider" = "Provider";
    static "EventBusAdapter" = "EventBusAdapter";
    static "ActionBusAdapter" = "ActionBusAdapter";
    static "Domain" = "Domain";
    static "Application" = "ApplicationFactory";
    static "ServerAdapter" = "ServerAdapter";
    static Container = "Container";
    static ProviderFactory = "ProviderFactory";
    static TestUser = "TestUser";
    static RequestContext = "RequestContext";
}

/**
 * Component life time
 *
 * @export
 * @enum {number}
 */
export enum LifeTime {
    /**
     * Only one instance
     */
    Singleton = 1,
    /**
     * Create a new instance every time
     */
    Transient = 2,
    /**
     * Create one instance per request
     */
    Scoped=4
}

/**
 * Used to initialize a constructor parameter with a component
 *
 * @export
 * @param {string} component name
 * @param {boolean} [optional] True to not raise an exception if component doesn't exist
 */
export function Inject(name: string, optional?: boolean) {
    return function(target, key, i) {
        let injects = Reflect.getOwnMetadata(Symbol.for("di:injects"), target) || [];
        injects[i] = {name:name, optional:!!optional};
        Reflect.defineMetadata(Symbol.for("di:injects"), injects, target);
    }
}

/**
 * Used to declare a component.
 *
 * @export
 * @param {LifeTime} lifeTime of the component
 * @param {string} [name] - By default this is the class name
 */
export function Injectable(lifeTime: LifeTime, name?:string)
{
    return function(target)
    {
        name = name || target.name;
        Preloader.registerPreload( target, ( container, domain ) =>
            {
            container.inject(name, target, lifeTime);
            }
        );
    }
}
