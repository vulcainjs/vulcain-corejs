import {HystrixSSEStream as hystrixStream} from './commands/http/hystrixSSEStream';
import {ICommandBusAdapter, IEventBusAdapter} from './bus/busAdapter';
import {LocalAdapter} from './bus/localAdapter';
import * as Path from 'path'
import * as fs from 'fs'
import { Domain } from './schemas/schema'
import { Container } from './di/containers'
import { Files } from './utils/files'
import { ExpressAdapter } from './servers/expressAdapter'
import 'reflect-metadata'
import {LifeTime} from './di/annotations';
import {IContainer} from "./di/resolvers";
import {MemoryProvider} from "./providers/memory/provider";
import {MongoProvider} from "./providers/mongo/provider";
import {AbstractAdapter} from './servers/abstractAdapter';
import {DynamicConfiguration, VulcainLogger} from '@sovinty/vulcain-configurations'
import {RabbitAdapter} from './bus/rabbitAdapter'
import {Conventions} from './utils/conventions';

var parent = module.parent.parent || module.parent;
var parentFile = parent.filename;
var parentDir = Path.dirname(parentFile);
//delete require.cache[module.filename];

export enum BusUsage {
    all,
    commandOnly,
    eventOnly
}

export class DefaultServiceNames
{
    static "Authentication" = "Authentication";
    static "Logger" = "Logger";
    static "Provider" = "Provider";
    static "EventBusAdapter" = "EventBusAdapter";
    static "CommandBusAdapter" = "CommandBusAdapter";
}

export abstract class Application
{
    static Preloads: Array<Function> = [];

    private _executablePath: string;
    private _container:IContainer;
    private _domain: Domain;
    public enableHystrixStream: boolean;
    private _basePath: string;

    setStaticRoot(basePath: string) {
        this.adapter.setStaticRoot(basePath);
    }

    /**
     * Current component container
     * @returns {Container}
     */
    get container() { return this._container; }

    /**
     * Get the current domain model
     * @returns {Domain}
     */
    get domain() {
        if (!this._domain) {
            this._domain = new Domain(this.domainName);
        }
        return this._domain;
    }

    set domain(domain: Domain) {
        this._domain = domain;
    }

    /**
     * Create new application
     * @param path Files base path for components discovery
     * @param container Global component container
     * @param app  (optional)Server adapter
     */
    constructor(public domainName?:string, container?: IContainer, public adapter?: AbstractAdapter) {
        this.domainName = domainName || process.env.VULCAIN_DOMAIN;
        if (!this.domainName)
            throw new Error("VULCAIN_DOMAIN is required.");
        this._executablePath = Path.dirname(module.filename);
        this._basePath = parentDir;
        this._container = container || new Container();
        this._container.injectInstance(new VulcainLogger(), "Logger");
        this._container.injectTransient(MemoryProvider, "Provider");
        this._container.injectInstance(this, "ApplicationFactory");
        this._container.injectInstance(this.domain, "Domain");
    }

    private startHystrixStream() {
        if (!this.enableHystrixStream)
            return;

        this.adapter.useMiddleware("get", Conventions.defaultHystrixPath,  (request, response) => {
            response.append('Content-Type', 'text/event-stream;charset=UTF-8');
            response.append('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
            response.append('Pragma', 'no-cache');
            console.log("get hystrix.stream");

            let subscription = hystrixStream.toObservable().subscribe(
                function onNext(sseData) {
                    response.write('data: ' + sseData + '\n\n');
                },
                function onError(error) {
                    console.log("hystrixstream: error");
                },
                function onComplete() {
                    console.log("end hystrix.stream");
                    return response.end();
                }
            );
            request.on("close", () => {
                console.log("close hystrix.stream");
                subscription.dispose();
            })

            return subscription;
        });
    }

    protected useRabbitAdapter(address:string, usage = BusUsage.all) {
        let bus = new RabbitAdapter(address);
        if( usage === BusUsage.all || usage === BusUsage.eventOnly)
            this.container.injectInstance(bus, DefaultServiceNames.EventBusAdapter);
        if( usage === BusUsage.all || usage === BusUsage.commandOnly)
            this.container.injectInstance(bus, DefaultServiceNames.CommandBusAdapter);
    }

    protected useMongoProvider(name:string, schema: string | any, uri: string, mongoOptions?) {
        schema = this.domain.getSchema(schema);
        this.container.injectSingleton(MongoProvider, name, schema, uri, mongoOptions);
    }

    protected useMemoryProvider(name:string, schema: string | any, folder?:string) {
        schema = this.domain.getSchema(schema);
        this.container.injectSingleton(MemoryProvider, name, schema, folder);
    }

    protected initializeServices(container: IContainer) {

    }

    start(port: number) {
        this.initializeServices(this.container);

        let local = new LocalAdapter();
        let eventBus = this.container.get(DefaultServiceNames.EventBusAdapter) || local;
        let commandBus = this.container.get(DefaultServiceNames.CommandBusAdapter) || local;

        eventBus.startAsync().then(() => {
            commandBus.startAsync().then(() => {
                this.registerModelsInternal()
                this.registerServicesInternal();
                this.registerHandlersInternal();

                Application.Preloads.forEach(fn => fn(this));
                Application.Preloads = null;

                this.adapter = this.adapter || new ExpressAdapter(this.domainName, this._container);
                this.startHystrixStream()
                this.adapter.start(port);
            });
        });
    }


    private registerModelsInternal() {
        this.registerModels(Path.join(this._executablePath, "defaults/models"));

        let path = Conventions.defaultModelsFolderPattern.replace("${base}", Conventions.defaultApplicationFolder);
        this.registerModels( Path.join(this._basePath, path) );
    }

    /**
     * Discover models components
     * @param path Where to find models component relative to base path (default=/api/models)
     * @returns {Container}
     */
    registerModels(path:string)
    {
        Files.traverse( path, ( name, val ) =>
        {
            if(!this.domain.findSchemaDescription(val.name))
                this.domain.addSchemaDescription( val );
        } );

        return this._container;
    }


    private registerHandlersInternal() {
        this.registerHandlers(Path.join(this._executablePath, "defaults/handlers"));
        let path = Conventions.defaultHandlersFolderPattern.replace("${base}", Conventions.defaultApplicationFolder);
        this.registerHandlers( Path.join(this._basePath, path) );
    }

    /**
     * Discover models components
     * @param path Where to find models component relative to base path (default=/api/models)
     * @returns {Container}
     */
    registerHandlers(path:string)
    {
        Files.traverse( path );
        return this._container;
    }

    private registerServicesInternal() {
        this.registerServices(Path.join(this._executablePath, "defaults/services"));

        let path = Conventions.defaultServicesFolderPattern.replace("${base}", Conventions.defaultApplicationFolder);
        this.registerServices(Path.join(this._basePath, path));
    }

    /**
     * Discover service components
     * @param path Where to find services component relative to base path (default=/core/services)
     * @returns {Container}
     */
    private registerServices(path:string) {
        Files.traverse(path, (name, val) => {
            let attr = Reflect.getMetadata(Symbol.for("di:export"), val);
            if (attr && attr.lifeTime) {
                switch (<LifeTime>attr.lifeTime) {
                    case LifeTime.Singleton:
                        this._container.injectSingleton(val);
                        break;
                    case LifeTime.Scoped:
                        this._container.injectScoped(val);
                        break;
                    case LifeTime.Transient:
                        this._container.injectTransient(val);
                        break;
                }
            }
            else
                this._container.injectTransient(val);
        });

        return this._container;
    }
}
