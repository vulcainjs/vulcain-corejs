import { Container } from './containers';
import { LifeTime } from './annotations';

export enum BusUsage {
    all,
    commandOnly,
    eventOnly
}

export interface IContainer {
    injectInstance(fn, name: string): IContainer;
    injectSingleton(fn, ...args): IContainer;
    injectSingleton(fn, name?: string, ...args): IContainer;
    injectSingleton(fn, nameOrArray: string | Array<any>, ...args): IContainer;
    injectTransient(fn, ...args): IContainer;
    injectTransient(fn, name?: string, ...args): IContainer;
    injectTransient(fn, nameOrArray: string | Array<any>, ...args): IContainer;
    injectScoped(fn, ...args): IContainer;
    injectScoped(fn, name?: string, ...args): IContainer;
    injectScoped(fn, nameOrArray: string | Array<any>, ...args): IContainer;
    /**
     * Inject all components founded recursivly in a folder.
     *
     * @param {string} path Root folder relative to current folder
     * @returns {IContainer}
     */
    injectFrom(path: string): IContainer;
    /**
     * Get a component by name
     *
     * @template T
     * @param {string} name Component name
     * @param {boolean} [optional] if true doesn't throw an exception if the component doesn't exist
     * @param {LifeTime} [assertLifeTime] If provided check if the component has been injected with the same lifetime value
     * @returns {T} A component
     */
    get<T>(name: string, optional?: boolean, assertLifeTime?: LifeTime): T;
    /**
     * Create a new component resolving all its dependencies
     *
     * @param {any} fn A component class
     * @param {any} args Custom arguments
     */
    resolve(fn, ...args);
    dispose();
    useRabbitBusAdapter(address?: string, usage?: BusUsage);
    useMongoProvider(uri: string, mongoOptions?);
    useMemoryProvider(folder?: string);
    inject(name: string, fn, lifeTime: LifeTime);
}

export interface IResolver {
    lifeTime: LifeTime;
    resolve(container: Container, name?: string, parentContainer?: Container);
}

export class InstanceResolver implements IResolver {
    public lifeTime: LifeTime = LifeTime.Singleton;

    constructor(private instance) { }

    resolve(container: Container, name?: string) {
        return this.instance;
    }
}

export class Resolver implements IResolver {
    static nb: number = 0;

    constructor(private fn, public lifeTime: LifeTime, private args?: Array<any>) { }

    resolve(container: Container, name?: string) {
        let injects;
        try { injects = Reflect.getMetadata(Symbol.for("di:injects"), this.fn); } catch (e) { }
        let params = [];

        if (injects) {
            try {
                for (var inject in injects) {
                    let info = injects[inject];
                    params.push(container.get<any>(info.name, info.optional));
                }
            }
            catch (e) {
                throw new Error(`Error when instanciating component ${name} on injected parameter : ${e.message}`);
            }
        }

        if (this.args) {
            this.args.forEach(a => {
                params.push(a);
            });
        }

        let component = invoke(this.fn, params);
        component._id = Resolver.nb++;
        return component;
    }
}

export class SingletonResolver extends Resolver {
    constructor(fn, args?: Array<any>) {
        super(fn, LifeTime.Singleton, args);
    }

    resolve(container: Container, name?: string, parentContainer?: Container) {
        let instance = name && container.scope.getInstance(name);
        if (!instance) {
            instance = super.resolve(container, name);
            // Add instance in the container where the resolver was defined
            if (name && instance)
                parentContainer.scope.set(name, instance);
        }
        return instance;
    }
}

export class ScopedResolver extends Resolver {
    constructor(fn, args?: Array<any>) {
        super(fn, LifeTime.Scoped, args);
    }

    resolve(container: Container, name?: string) {
        let instance = name && container.scope.getInstance(name);
        if (!instance) {
            instance = super.resolve(container, name);
            // Add instance in the current scope
            if (name && instance)
                container.scope.set(name, instance);
        }
        instance.requestContext = container.scope.requestContext;
        return instance;
    }
}

function invoke(fn, args) {
    switch (args.length) {
        case 0: return new fn();
        case 1: return new fn(args[0]);
        case 2: return new fn(args[0], args[1]);
        case 3: return new fn(args[0], args[1], args[2]);
        case 4: return new fn(args[0], args[1], args[2], args[3]);
        case 5: return new fn(args[0], args[1], args[2], args[3], args[4]);
        case 6: return new fn(args[0], args[1], args[2], args[3], args[4], args[5]);
        case 7: return new fn(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
        default:
            return Reflect.construct(fn, args);
    }
}
