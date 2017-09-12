import 'reflect-metadata';
import { Preloader } from '../preloader';
import { Scope } from './scope';
import { IResolver, InstanceResolver, SingletonResolver, Resolver, ScopedResolver, IContainer, BusUsage } from './resolvers';
import { LifeTime, DefaultServiceNames } from './annotations';
import { Files } from '../utils/files';
import { Conventions } from '../utils/conventions';
import { VulcainLogger } from './../configurations/log/vulcainLogger';
import { System } from './../configurations/globals/system';
import { ConsoleMetrics } from '../metrics/consoleMetrics';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';
import { ServiceResolver } from '../configurations/globals/serviceResolver';
import { RequestContext } from "../pipeline/requestContext";
import { DefaultAuthorizationPolicy } from "../security/authorizationPolicy";
import { HttpRequest } from "../pipeline/vulcainPipeline";
import { TokenService } from "../security/services/tokenService";
import { MemoryProvider } from "../providers/memory/provider";
import { DefaultTenantPolicy } from "../pipeline/policies/defaultTenantPolicy";
import { ProviderFactory } from "../providers/providerFactory";
import { MetricsFactory } from "../metrics/metrics";
import { ServiceDescriptors } from "../pipeline/handlers/serviceDescriptions";
import { MockManager } from "../mocks/mockManager";
import { MongoProvider } from "../providers/mongo/provider";
import { HttpResponse } from "../pipeline/response";
import { TrackerFactory } from "../metrics/trackers/index";
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
    private resolvers: Map<string, IResolver> = new Map<string, IResolver>();
    public scope: Scope;
    private disposed = false;

    /**
     * Creates an instance of Container.
     *
     * @param {IContainer} [parent]
     * @param {RequestContext} [requestContext]
     *
     * @memberOf Container
     */
    constructor(private parent?: IContainer, requestContext?: RequestContext) {
        if (parent && !requestContext)
            throw new Error("RequestContext must not be null.");

        this.scope = new Scope(parent && (<any>parent).scope, requestContext);
        this.injectInstance(this, DefaultServiceNames.Container);

        this.setRequestContext(requestContext);

        if (!parent) {
            this.injectInstance(new VulcainLogger(), DefaultServiceNames.Logger);
            this.injectSingleton(DefaultAuthorizationPolicy, DefaultServiceNames.AuthorizationPolicy);
            this.injectSingleton(ServiceResolver, DefaultServiceNames.ServiceResolver);
            //this.injectScoped(SwaggerServiceDescriptor, DefaultServiceNames.SwaggerServiceDescriptor);
            this.injectSingleton(ServiceDescriptors, DefaultServiceNames.ServiceDescriptors);
            this.injectSingleton(ProviderFactory, DefaultServiceNames.ProviderFactory);
            this.injectSingleton(DefaultTenantPolicy, DefaultServiceNames.TenantPolicy);
            this.injectSingleton(MockManager, DefaultServiceNames.MockManager);
            this.injectTransient(MemoryProvider, DefaultServiceNames.Provider);
            this.injectSingleton(TokenService, DefaultServiceNames.TokenService);
            this.injectInstance(MetricsFactory.create(this), DefaultServiceNames.Metrics);
            this.injectInstance(TrackerFactory.create(this), DefaultServiceNames.RequestTracker);
            this.injectSingleton(ScopesDescriptor, DefaultServiceNames.ScopesDescriptor);
            this.injectScoped(SwaggerServiceDescriptor, DefaultServiceNames.SwaggerServiceDescriptor);
        }
    }

    /**
     * used by test
     *
     * @protected
     * @param {RequestContext} requestContext
     *
     * @memberOf Container
     */
    protected setRequestContext(requestContext: RequestContext) {
        if (requestContext) {
            this.injectInstance(requestContext, DefaultServiceNames.RequestContext);
            this.scope.requestContext = requestContext;
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
        let uri = System.resolveAlias(address) || DynamicConfiguration.getPropertyValue<string>("rabbit") || address;
        if (!uri) {
            System.log.info(null, () => "no value found for rabbit address. Ignore adapter");
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
        let uri = System.resolveAlias(address) || DynamicConfiguration.getPropertyValue<string>("mongo") || address;
        if (!uri) {
            System.log.info(null, () => "no value found for mongo address. Ignore adapter");
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
        this.resolvers.set(name, new InstanceResolver(fn));
        if (name !== "Container" && fn.name)
            System.log.info(null, () => "INFO: Register instance component " + name + " as " + fn.name);
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
        this.resolvers.set(name, new SingletonResolver(fn, Array.from(args)));
        if (fn.name)
            System.log.info(null, () => "INFO: Register instance component " + name + " as " + fn.name);
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
        this.resolvers.set(name, new Resolver(fn, LifeTime.Transient, Array.from(args)));
        if (fn.name)
            System.log.info(null, () => "INFO: Register instance component " + name + " as " + fn.name);
        return this;
    }

    /**
     * Scoped by request. Component are initialized with the current requestContext
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
        this.resolvers.set(name, new ScopedResolver(fn, Array.from(args)));
        if (fn.name)
            System.log.info(null, () => "INFO: Register instance component " + name + " as " + fn.name);
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
     * Instanciate a component and resolve all its dependencies
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

    private findResolver(name: string) {
        let self: Container = this;
        while (self) {
            let resolver = self.resolvers.get(name);
            if (resolver)
                return { resolver, container: self };
            self = <Container>self.parent;
        }
        return null;
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
        let res = this.findResolver(name);
        let resolver = res && res.resolver;
        if (assertLifeTime && resolver) {
            if (!(assertLifeTime & resolver.lifeTime))
                throw new Error("Component " + name + " must be declared with a life time = " + assertLifeTime);
        }
        let component = this._resolve(res && res.container, resolver, name, optional);
        return <T>component;
    }

    private customEndpoints: { verb: string, path: string, handler: (req: HttpRequest) => HttpResponse }[] = [];

    registerEndpoint(path: string, handler: (req: HttpRequest) => HttpResponse) {
        this.customEndpoints.push({ path, handler, verb: "get" });
    }

    getCustomEndpoints(): { verb: string, path: string, handler: (req: HttpRequest) => HttpResponse }[] {
        return this.customEndpoints;
    }

}

/**
 * Default container for test
 *
 * @export
 * @class TestContainer
 * @extends {Container}
 */
/*export class TestContainer extends Container {
    constructor(public domainName: string, addDefaultServices?: (container: IContainer) => void) {
        super();
        this.setRequestContext(RequestContext.createMock(this));

        this.injectTransient(MemoryProvider, DefaultServiceNames.Provider);
        let domain = new Domain(domainName, this);
        this.injectInstance(domain, DefaultServiceNames.Domain);

        addDefaultServices && addDefaultServices(this);

        Preloader.instance.runPreloads(this, domain);
    }
}*/
