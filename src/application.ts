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
import {LifeTime, DefaultServiceNames} from './di/annotations';
import {IContainer} from "./di/resolvers";
import {AbstractAdapter} from './servers/abstractAdapter';
import {DynamicConfiguration, VulcainLogger} from 'vulcain-configurationsjs'
import {Conventions} from './utils/conventions';
import {MemoryProvider} from "./providers/memory/provider";

export class Application
{
    private static _preloads: Array<Function> = [];

    static registerPreload(fn: Function, callback: (Container: IContainer, domain: Domain) => void) {
        let key = fn.name;
        Application._preloads.push(callback);
    }

    static runPreloads(container: IContainer, domain: Domain) {
        if (Application._preloads) {
            for (const callback of Application._preloads) {
                callback(container, domain);
            }
            Application._preloads = null;
        }
    }

    private _executablePath: string;
    private _container:IContainer;
    private _domain: Domain;
    public enableHystrixStream: boolean;
    private _basePath: string;
    public adapter: AbstractAdapter;

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
        return this._domain;
    }

    private findBasePath() {
        let parent = module.parent;
        while (parent.parent)
            parent = parent.parent;
        return Path.dirname(parent.filename);
    }

    /**
     * Create new application
     * @param path Files base path for components discovery
     * @param container Global component container
     * @param app  (optional)Server adapter
     */
    constructor(container?: IContainer) {
        this._executablePath = Path.dirname(module.filename);
        this._basePath = this.findBasePath();
        this._container = container || new Container();
        this._container.injectInstance(new VulcainLogger(), DefaultServiceNames.Logger);
        this._container.injectTransient(MemoryProvider, DefaultServiceNames.Provider);
        this._container.injectInstance(this, DefaultServiceNames.Application);
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

    start(domainName:string, port: number, preinitializeServerAdapter?: (abstractAdapter:AbstractAdapter) => void) {
        domainName = domainName || process.env.VULCAIN_DOMAIN;
        if (!domainName)
            throw new Error("Domain name is required.");

        this._domain = new Domain(domainName, this._container);
        this._container.injectInstance(this.domain, DefaultServiceNames.Domain);

        let local = new LocalAdapter();
        let eventBus = this.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter, true);
        if (!eventBus) {
            this.container.injectInstance(local, DefaultServiceNames.EventBusAdapter);
            eventBus = local;
        }
        let commandBus = this.container.get<ICommandBusAdapter>(DefaultServiceNames.ActionBusAdapter, true);
        if (!commandBus) {
            this.container.injectInstance(local, DefaultServiceNames.ActionBusAdapter);
            commandBus = local;
        }

        eventBus.startAsync().then(() => {
            commandBus.startAsync().then(() => {
                this.registerModelsInternal()
                this.registerServicesInternal();
                this.registerHandlersInternal();

                Application.runPreloads(this.container, this._domain);

                this.adapter = this.container.get<AbstractAdapter>(DefaultServiceNames.ServerAdapter, true);
                if (!this.adapter) {
                    this.adapter = new ExpressAdapter(this.domain.name, this._container);
                    this.container.injectInstance(this.adapter, DefaultServiceNames.ServerAdapter);
                    preinitializeServerAdapter && preinitializeServerAdapter(this.adapter);
                }
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
