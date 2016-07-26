import 'reflect-metadata';
import {Scope} from './scope';
import {IResolver, InstanceResolver, SingletonResolver, Resolver} from './resolvers';
import {IContainer, BusUsage} from '../di/resolvers';
import {DefaultServiceNames} from '../application';
import {RabbitAdapter} from '../bus/rabbitAdapter'
import {LocalAdapter} from '../bus/localAdapter'
import {MemoryProvider} from "../providers/memory/provider";
import {MongoProvider} from "../providers/mongo/provider";
import {VulcainLogger} from 'vulcain-configurationsjs'
import {Domain} from '../schemas/schema';
import {Application} from '../application';

export class Container implements IContainer {

    private resolvers: Map<string,IResolver> = new Map<string,IResolver>();
    public scope: Scope;

    constructor(private parent?: IContainer) {
        this.scope = new Scope(parent && (<any>parent).scope);
        this.injectInstance(this, "Container");
    }

    dispose() {
        this.scope.dispose();
        this.resolvers.clear();
    }

    useRabbitBusAdapter(address:string, usage = BusUsage.all) {
        let bus = new RabbitAdapter(address);
        if( usage === BusUsage.all || usage === BusUsage.eventOnly)
            this.injectInstance(bus, DefaultServiceNames.EventBusAdapter);
        if( usage === BusUsage.all || usage === BusUsage.commandOnly)
            this.injectInstance(bus, DefaultServiceNames.ActionBusAdapter);
    }

    useMongoProvider(uri: string, mongoOptions?) {
        this.injectSingleton(MongoProvider, DefaultServiceNames.Provider, uri, mongoOptions);
    }

    useMemoryProvider(folder?:string) {
        this.injectSingleton(MemoryProvider, DefaultServiceNames.Provider, folder);
    }

    /**
     *
     * @param name
     * @param fn
     * @returns {Container}
     */
    injectInstance(fn, name:string) {
        if(!name) throw new Error("Name is required.");
        this.resolvers.set(name, new InstanceResolver(fn));
        if(name !== "Container")
            console.log("INFO: Register instance component " + name + " as " + (fn.name || '<unnamed>'));
        return this;
    }

    /**
     *
     * @param fn
     * @param args
     */
    injectSingleton(fn, ...args);
    injectSingleton(fn, name?:string, ...args);
    injectSingleton(fn, nameOrArray:string|Array<any>, ...args) {
        let name:string;
        if(Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        } else {
            name = nameOrArray;
        }
        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if (!name) throw new Error("Can not find a name when injecting component. Use @Export.");
        this.resolvers.set(name, new SingletonResolver(fn, Array.from(args)));
        console.log("INFO: Register singleton component " + name + " as " + (fn.name || '<unnamed>'));
        return this;
    }

    /**
     *
     * @param fn
     * @param args
     */
    injectTransient(fn, ...args);
    injectTransient(fn, name?:string, ...args);
    injectTransient(fn, nameOrArray:string|Array<any>, ...args) {
        let name:string;
        if(Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        }
        else {
            name = nameOrArray;
        }

        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if(!name)
            return;
        this.resolvers.set(name, new Resolver(fn, Array.from(args)));
        console.log("INFO: Register transient component " + name + " as " + (fn.name || '<unnamed>'));
        return this;
    }

    /**
     *
     * @param fn
     * @param args
     */
    injectScoped(fn, ...args);
    injectScoped(fn, name?:string, ...args);
    injectScoped(fn, nameOrArray:string|Array<any>, ...args) {
        let name:string;
        if(Array.isArray(nameOrArray)) {
            args = <Array<any>>nameOrArray;
            name = null;
        }
        else {
            name = nameOrArray;
        }

        let attr = Reflect.getOwnMetadata(Symbol.for("di:export"), fn);
        name = name || attr && attr.name || fn.name;
        if (!name) throw new Error("Cannot find a name when injecting component. Use @Export.");
        this.resolvers.set(name, new Resolver(fn, Array.from(args), true));
        console.log("INFO: Register scoped component " + name + " as " + fn.name);
        return this;
    }

    /**
     *
     * @param fn
     * @param args
     * @returns {null}
     */
    resolve(fn, ...args) {
        if(typeof fn !== "function") throw new Error("fn must be a ctor");
        let resolver = new Resolver(fn, Array.from(args));
        return this._resolve(resolver);
    }

    private _resolve(resolver:IResolver, name?:string, optional?:boolean) {

        let instance = resolver && resolver.resolve(this, name);

        if(!instance && !optional)
            throw new Error("Unable to resolve component " + name);

        return instance;
    }

    private findResolver(name: string) {
        let self:Container = this;
        while (self) {
            let resolver = self.resolvers.get(name);
            if (resolver)
                return resolver;
            self = <Container>self.parent;
        }
        return null;
    }

    /**
     *
     * @param name
     * @param scope
     * @param optional
     * @returns {any}
     */
    get<T>(name:string, optional?:boolean) {
        let resolver = this.findResolver(name);
        let component = this._resolve(resolver, name, optional);
        return <T>component;
    }
}

export class TestContainer extends Container {
    constructor(public domainName: string, addServices?: (Container: IContainer) => void) {
        super();
        this.injectInstance(new VulcainLogger(), DefaultServiceNames.Logger);
        this.injectSingleton(MemoryProvider, DefaultServiceNames.Provider);
        let domain = new Domain(domainName);
        this.injectInstance(domain, DefaultServiceNames.Domain);

        addServices && addServices(this);
        Application.runPreloads(this, domain);
    }
}
