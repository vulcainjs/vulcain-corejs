import 'reflect-metadata';
import { Preloader } from '../preloader';
import { Scope } from './scope';
import { IResolver, InstanceResolver, SingletonResolver, Resolver, ScopedResolver, IContainer, BusUsage } from './resolvers';
import { LifeTime, DefaultServiceNames } from './annotations';
import { Files } from '../utils/files';
import { Conventions } from '../utils/conventions';
import { VulcainLogger } from './../log/vulcainLogger';
import { Service } from './../globals/system';
import { ConsoleMetrics } from '../instrumentations/metrics/consoleMetrics';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { ServiceResolver } from '../di/serviceResolver';
import { RequestContext } from "../pipeline/requestContext";
import { DefaultAuthorizationPolicy } from "../security/authorizationPolicy";
import { HttpRequest } from "../pipeline/vulcainPipeline";
import { TokenService } from "../security/services/tokenService";
import { MemoryProvider } from "../providers/memory/provider";
import { DefaultTenantPolicy } from "../pipeline/policies/defaultTenantPolicy";
import { ProviderFactory } from "../providers/providerFactory";
import { MetricsFactory } from "../instrumentations/metrics";
import { ServiceDescriptors } from "../pipeline/handlers/serviceDescriptions";
import { StubManager } from "../stubs/stubManager";
import { MongoProvider } from "../providers/mongo/provider";
import { HttpResponse } from "../pipeline/response";
import { TrackerFactory } from "../instrumentations/trackers/index";
import { ScopesDescriptor } from "../defaults/scopeDescriptors";
import { SwaggerServiceDescriptor } from '../defaults/swagger/swaggerServiceDescriptions';

/**
 * Component container for dependency injection
 *
 * @export
 * @class Container
 * @implements {IContainer}
 */
export class Container implements IContainer {
    private resolvers: Map<string, IResolver[]> = new Map<string, IResolver[]>();
    public scope: Scope;
    private disposed = false;

    /**
     * Creates an instance of Container.
     *
     * @param {IContainer} [parent]
     * @param {RequestContext} [context]
     *
     * @memberOf Container
     */
    constructor(private parent?: IContainer, context?: RequestContext) {
        if (parent && !context)
            throw new Error("RequestContext must not be null.");

        this.scope = new Scope(parent && (<any>parent).scope, context);
        this.injectInstance(this, DefaultServiceNames.Container);

        this.setRequestContext(context);

        if (!parent) {
            this.injectInstance(new VulcainLogger(), DefaultServiceNames.Logger);
            this.injectSingleton(DefaultAuthorizationPolicy, DefaultServiceNames.AuthorizationPolicy);
            this.injectSingleton(ServiceResolver, DefaultServiceNames.ServiceResolver);
            //this.injectScoped(SwaggerServiceDescriptor, DefaultServiceNames.SwaggerServiceDescriptor);
            this.injectSingleton(ServiceDescriptors, DefaultServiceNames.ServiceDescriptors);
            this.injectSingleton(ProviderFactory, DefaultServiceNames.ProviderFactory);
            this.injectSingleton(DefaultTenantPolicy, DefaultServiceNames.TenantPolicy);
            this.injectSingleton(StubManager, DefaultServiceNames.StubManager);
            this.injectTransient(MemoryProvider, DefaultServiceNames.Provider);
            this.injectSingleton(TokenService, DefaultServiceNames.AuthenticationStrategy);
            this.injectInstance(MetricsFactory.create(this), DefaultServiceNames.Metrics);
            this.injectInstance(TrackerFactory.create(this), DefaultServiceNames.RequestTracker);
            this.injectSingleton(ScopesDescriptor, DefaultServiceNames.ScopesDescriptor);
            this.injectScoped(SwaggerServiceDescriptor, DefaultServiceNames.SwaggerServiceDescriptor);

            // Try to initialize Rabbit provider if there is a 'mongo' environment variable
            let rabbitAddress = DynamicConfiguration.getPropertyValue<string>("rabbit");
            if(rabbitAddress)
                this.useRabbitBusAdapter(rabbitAddress);

                // Try to initialize Mongo provider if there is a 'mongo' environment variable
            let mongoAddress = DynamicConfiguration.getPropertyValue<string>("mongo");
            if(mongoAddress)
                this.useMongoProvider(mongoAddress);
        }
    }

    /**
     * used by test
     *
     * @protected
     * @param {RequestContext} context
     *
     * @memberOf Container
     */
    protected setRequestContext(context: RequestContext) {
        if (context) {
            this.scope.context = context;
        }
    }

    dispose() {
        this.scope.dispose();
        this.resolvers.clear();
        this.parent = null;
        this.disposed = true;
    }

    /**
     * Inject all components from files of the specified folder.
     * Files are loaded recursively
     *
     * @param {string} folder path relative to the current directory
     * @returns the current container
     */
    injectFrom(path: string) {
        Files.traverse(path);
        return this;
    }

    /**
     *
     *
     * @param {string} address rabbitmq server address (only host name and optional port)
     * @param {any} [usage=BusUsage.all]
     */
    useRabbitBusAdapter(address?: string, usage = BusUsage.all) {
        let uri = Service.resolveAlias(address) || DynamicConfiguration.getPropertyValue<string>("rabbit") || address;
        if (!uri) {
            Service.log.info(null, () => "no value found for rabbit address. Ignore adapter");
            return;
        }
        if (!uri.startsWith("amqp://")) {
            uri = "amqp://" + uri;
        }
        let bus;// = new RabbitAdapter(uri);
        if (usage === BusUsage.all || usage === BusUsage.eventOnly)
            this.injectInstance(bus, DefaultServiceNames.EventBusAdapter);
        if (usage === BusUsage.all || usage === BusUsage.commandOnly)
            this.injectInstance(bus, DefaultServiceNames.ActionBusAdapter);
    }

    /**
     * Use mongo provider
     *
     * @param {string} mongo server address (only host name or list of host names)
     * @param {any} [mongoOptions] Mongodb options
     */
    useMongoProvider(address?: string, mongoOptions?) {
        let uri = Service.resolveAlias(address) || DynamicConfiguration.getPropertyValue<string>("mongo") || address;
        if (!uri) {
            Service.log.info(null, () => "no value found for mongo address. Ignore adapter");
            return;
        }
        if (!uri.startsWith("mongodb://")) {
            uri = "mongodb://" + uri;
        }
        this.injectTransient(MongoProvider, DefaultServiceNames.Provider, uri, mongoOptions);
    }

    /**
     * Use a memory provider by default
     *
     * @param {string} [folder] Data can be persisted on disk (on every change)
     */
    useMemoryProvider(folder?: string) {
        this.injectTransient(MemoryProvider, DefaultServiceNames.Provider, folder);
    }

    // Insert always in first position
    // so 'get' take the last inserted
    private addResolver(name: string, resolver: IResolver) {
        let list = this.resolvers.get(name) || [];
        list.unshift(resolver);
        this.resolvers.set(name, list);
    }

    /**
     * Register a instance of a component
     *
     * @param name
     * @param fn
     * @returns {Container}
     */
    injectInstance(fn, name: string) {
        if (!fn)
            return;

        if (!name) throw new Error("Name is required.");
        this.addResolver(name, new InstanceResolver(fn));
        if (name !== "Container" && fn.name)
            Service.log.verbose(null, () => "INFO: Register instance component " + name + " as " + fn.name);
        return this;
    }

    /**
     * Register a component as a singleton. It will be created on first use.
     *
     * @param fn
     * @param args
     */
    injectSingleton(fn, ...args);
    injectSingleton(fn, name?: string, ...args);
    injectSingleton(fn, nameOrArray: string | Array<any>, ...args) {
        if (!fn)
            return;
        let name: string;
        if (Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        } else {
            name = nameOrArray;
        }
        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if (!name) throw new Error("Can not find a name when injecting component. Use @Export.");

        this.addResolver(name, new SingletonResolver(fn, Array.from(args)));

        if (fn.name)
            Service.log.verbose(null, () => "INFO: Register instance component " + name + " as " + fn.name);

        return this;
    }

    /**
     * A new component are always created
     *
     * @param fn Component constructor
     * @param args
     */
    injectTransient(fn, ...args);
    injectTransient(fn, name?: string, ...args);
    injectTransient(fn, nameOrArray: string | Array<any>, ...args) {
        if (!fn)
            return;
        let name: string;
        if (Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        }
        else {
            name = nameOrArray;
        }

        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if (!name)
            return;
        this.addResolver(name, new Resolver(fn, LifeTime.Transient, Array.from(args)));
        if (fn.name)
            Service.log.verbose(null, () => "INFO: Register instance component " + name + " as " + fn.name);
        return this;
    }

    /**
     * Scoped by request. Component are initialized with the current context
     *
     * @param fn
     * @param args
     */
    injectScoped(fn, ...args);
    injectScoped(fn, name?: string, ...args);
    injectScoped(fn, nameOrArray: string | Array<any>, ...args) {
        if (!fn)
            return;
        let name: string;
        if (Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        }
        else {
            name = nameOrArray;
        }

        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if (!name) throw new Error("Cannot find a name when injecting component. Use @Export.");
        this.addResolver(name, new ScopedResolver(fn, Array.from(args)));
        if (fn.name)
            Service.log.verbose(null, () => "INFO: Register instance component " + name + " as " + fn.name);
        return this;
    }

    /**
     * Helper for injecting component
     *
     * @param {string} name Component name
     * @param {any} fn Component constructor
     * @param {LifeTime} lifeTime Component lifetime
     *
     * @memberOf Container
     */
    inject(name: string, fn, lifeTime: LifeTime) {
        if (lifeTime) {
            switch (lifeTime) {
                case LifeTime.Singleton:
                    this.injectSingleton(fn, name);
                    break;
                case LifeTime.Scoped:
                    this.injectScoped(fn, name);
                    break;
                case LifeTime.Transient:
                    this.injectTransient(fn, name);
                    break;
            }
        }
        else
            this.injectTransient(fn, name);
    }

    /**
     *
     * Instantiate a component and resolve all its dependencies
     * @param fn Component constructor
     * @param args List of optional arguments
     * @returns {null}
     */
    resolve(fn, ...args) {
        if (typeof fn !== "function") throw new Error("fn must be a ctor");
        let resolver = new Resolver(fn, LifeTime.Transient, Array.from(args));
        return this._resolve(this, resolver);
    }

    private _resolve(parentContainer: Container, resolver: IResolver, name?: string, optional?: boolean) {

        if (this.disposed) {
            throw new Error("Can not resolved component from a disposed container.");
        }
        let instance = resolver && resolver.resolve(this, name, parentContainer);

        if (!instance && !optional)
            throw new Error("Unable to resolve component " + name);

        return instance;
    }

    private findResolvers(name: string) {
        let self: Container = this;
        let list: {resolver: IResolver, container: Container}[] = [];
        while (self) {
            let resolvers = self.resolvers.get(name);
            if (resolvers) {
                list = list.concat( resolvers.map(resolver=>{ return { resolver, container: self }; }));
            }
            self = <Container>self.parent;
        }
        return list;
    }

    /**
     * Get a component by name.
     * Throw an exception if the component doesn't exist
     * @template T
     * @param {string} component name
     * @param {boolean} [optional] if true no exception are raised if the component doesn't exist
     * @param {LifeTime} [assertLifeTime] If provide check if the registered component has the expected {LifeTime}
     * @returns A component
     */
    get<T>(name: string, optional?: boolean, assertLifeTime?: LifeTime) {
        let resolvers = this.findResolvers(name);
        let item = resolvers.length > 0 && resolvers[0];
        if (assertLifeTime && item) {
            if (!(assertLifeTime & item.resolver.lifeTime))
                throw new Error("Component " + name + " must be declared with a life time = " + assertLifeTime);
        }
        let component = this._resolve(item && item.container, item.resolver, name, optional);
        return <T>component;
    }

    getList<T>(name: string): T[] {
        let resolvers = this.findResolvers(name);
        let list: T[] = [];
        for(let item of resolvers) {
            let component = this._resolve(item && item.container, item.resolver, name, true);
            if(component) {
                list.push(component);
            }
        }
        return list;
    }

    private customEndpoints: { verb: string, path: string, handler: (req: HttpRequest) => HttpResponse }[] = [];

    registerEndpoint(path: string, handler: (req: HttpRequest) => HttpResponse) {
        this.customEndpoints.push({ path, handler, verb: "get" });
    }

    getCustomEndpoints(): { verb: string, path: string, handler: (req: HttpRequest) => HttpResponse }[] {
        return this.customEndpoints;
    }

}
