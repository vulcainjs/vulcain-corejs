import 'reflect-metadata';
import { Preloader } from '../preloader';
import { System } from '../configurations/globals/system';
import { RequestContext } from '../servers/requestContext';

/**
 * List of default service names
 *
 * @export
 * @class DefaultServiceNames
 */
export class DefaultServiceNames {
    static TokenService = "TokenService";
    static AuthorizationPolicy = "AuthorizationPolicy";
    static TenantPolicy = "TenantPolicy";

    static ScopesDescriptor = "ScopesDescriptor";
    static ServiceDescriptors = "ServiceDescriptors";
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
    static Metrics = "Metrics";
    static ApiKeyService = "ApiKeyService";
    static MockManager = "MockManager";
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
    Scoped = 4
}

/**
 * Interface implemented by every scoped component
 *
 * @export
 * @interface IScopedComponent
 */
export interface IScopedComponent {
    /**
     * Current request context (scope)
     *
     * @type {RequestContext}
     */
    requestContext: RequestContext;
}

/**
 * Used to initialize a constructor parameter with a component
 *
 * @export
 * @param {string} component name
 * @param {boolean} [optional] True to not raise an exception if component doesn't exist
 */
export function Inject(name: string, optional?: boolean) {
    return function (target, key, i) {
        let injects = Reflect.getOwnMetadata(Symbol.for("di:injects"), target) ||  [];
        injects[i] = { name: name, optional: !!optional };
        Reflect.defineMetadata(Symbol.for("di:injects"), injects, target);
    };
}

/**
 * Used to declare a component.
 *
 * @export
 * @param {LifeTime} lifeTime of the component
 * @param {string} [name] - By default this is the class name
 * @param {enableOnTestOnly} Active this component only in an test environment
 */
export function Injectable(lifeTime: LifeTime, name?: string, enableOnTestOnly?: boolean) {
    return function (target) {
        if (enableOnTestOnly && !System.isTestEnvironnment)
            return;
        name = name || target.name;
        Preloader.instance.registerService(target, (container, domain) => {
            container.inject(name, target, lifeTime);
        }
        );
    };
}
