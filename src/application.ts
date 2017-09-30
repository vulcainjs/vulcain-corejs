import { Preloader } from './preloader'; // always on first line

import { IActionBusAdapter, IEventBusAdapter } from './bus/busAdapter';
import * as Path from 'path';
import { Domain } from './schemas/schema';
import { Container } from './di/containers';
import { Files } from './utils/files';
import 'reflect-metadata';
import { DefaultServiceNames } from './di/annotations';
import { IContainer } from "./di/resolvers";
import { Conventions } from './utils/conventions';
import { MemoryProvider } from "./providers/memory/provider";
import './defaults/schemasDescriptor'; // Don't remove (auto register)
import './defaults/serviceExplorer'; // Don't remove (auto register)
import './defaults/dependencyExplorer'; // Don't remove (auto register)
import { ScopesDescriptor } from './defaults/scopeDescriptors';  // Don't remove (auto register)
import { LifeTime } from "./di/annotations";
import { ApiKeyService } from "./security/services/apiKeyService";
import { ServiceDescriptors } from "./pipeline/handlers/serviceDescriptions";
import { HttpResponse } from "./pipeline/response";
import { VulcainServer } from "./pipeline/vulcainServer";
import { LocalAdapter } from "./bus/localAdapter";
import { System } from './globals/system';
import { DynamicConfiguration } from './configurations/dynamicConfiguration';

/**
 * Application base class
 *
 * @export
 * @abstract
 * @class Application
 */
export class Application {
    private _vulcainExecutablePath: string;
    private _basePath: string;

    private _domain: Domain;
    /**
     * Enable api key authentication
     *
     * @param {string} apiKeyServiceName Vulcain service name
     * @param {string} [version="1.0"] Service version
     *
     * @memberOf Application
     */
    enableApiKeyAuthentication(apiKeyServiceName: string, version = "1.0") {
        this.container.injectScoped(ApiKeyService, DefaultServiceNames.ApiKeyService, apiKeyServiceName, version);
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

    /**
     * Create new application
     * @param path Files base path for components discovery
     * @param container Global component container
     * @param app  (optional)Server adapter
     */
    constructor(private domainName?: string, private _container?: IContainer) {
        this._container = this._container || new Container();
    }

    private async init() {
        await DynamicConfiguration.getBuilder().startPollingAsync();

        if (!this.domainName) {
            throw new Error("Domain name is required.");
        }

        System.defaultDomainName = this.domainName;
        System.log.info(null, () => "Starting application");

        this._vulcainExecutablePath = Path.dirname(module.filename);
        this._basePath = Files.findApplicationPath();

        // Ensure initializing this first
        const test = System.isDevelopment;

        this._container.injectInstance(this, DefaultServiceNames.Application);
        this._domain = new Domain(this.domainName, this._container);
        this._container.injectInstance(this._domain, DefaultServiceNames.Domain);

        process.on('unhandledRejection', (reason, p) => {
            System.log.info(null, () => `Unhandled Rejection at ${p} reason ${reason}")`);
        });
    }

    /**
     * Define all scopes used in this service
     *
     * @protected
     * @param {ScopesDescriptor} scopes Scope definitions manager - Use scopes.defineScope for each scope
     *
     * @memberOf Application
     */
    protected defineScopeDescriptions(scopes: ScopesDescriptor) {

    }

    /**
     * Override this method to initialize default containers
     *
     * @protected
     * @param {IContainer} container
     */
    protected initializeDefaultServices(container: IContainer) {
    }

    /**
     * Initialize and start application
     *
     * @param {number} port
     */
    async start(port: number) {

        try {
            await this.init();

            this.initializeDefaultServices(this.container);

            let local = new LocalAdapter();
            let eventBus = this.container.get<IEventBusAdapter>(DefaultServiceNames.EventBusAdapter, true);
            if (!eventBus) {
                this.container.injectInstance(local, DefaultServiceNames.EventBusAdapter);
                eventBus = local;
            }
            let commandBus = this.container.get<IActionBusAdapter>(DefaultServiceNames.ActionBusAdapter, true);
            if (!commandBus) {
                this.container.injectInstance(local, DefaultServiceNames.ActionBusAdapter);
                commandBus = local;
            }

            this.registerComponents();
            Preloader.instance.runPreloads(this.container, this._domain);

            await eventBus.startAsync();
            await commandBus.startAsync();

            let scopes = this.container.get<ScopesDescriptor>(DefaultServiceNames.ScopesDescriptor);
            this.defineScopeDescriptions(scopes);

            let descriptors = this.container.get<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
            descriptors.createHandlersTable();

            let server = new VulcainServer(this.domain.name, this._container);
            server.start(port);
        }
        catch (err) {
            System.log.error(null, err, () => "ERROR when starting application");
            process.exit(2);
        }
    }

    private registerComponents() {
        this.registerRecursive(Path.join(this._vulcainExecutablePath, "defaults"));

        let path = Conventions.instance.defaultApplicationFolder;
        this.registerRecursive(Path.join(this._basePath, path));
    }

    /**
     * Discover models components
     * @param path Where to find models component relative to base path (default=/api/models)
     * @returns {Container}
     */
    private registerRecursive(path: string) {
        if (!Path.isAbsolute(path)) {
            path = Path.join(this._basePath, path);
        }
        Files.traverse(path);

        return this._container;
    }

    /**
     * Inject all components from a specific folder (relative to the current folder)
     *
     * @protected
     * @param {string} path Folder path
     * @returns The current container
     */
    protected injectFrom(path: string) {
        if (!Path.isAbsolute(path)) {
            path = Path.join(this._basePath, path);
        }
        this._container.injectFrom(path);
        return this._container;
    }
}

export class ApplicationBuilder {
    private app: Application;

    constructor(domain: string) {
        this.app = new Application(domain);
    }

    public useMongoProvider(address: string) {
        this.app.container.useMongoProvider(address);
        return this;
    }

    public useMemoryProvider(folder: string) {
        this.app.container.useMemoryProvider(folder);
        return this;
    }

    public useRabbitmqBus(address: string) {
        this.app.container.useRabbitBusAdapter(address);
        return this;
    }

    enableApiKeyAuthentication(apiKeyServiceName: string, version = "1.0") {
        this.app.enableApiKeyAuthentication(apiKeyServiceName, version);
        return this;
    }

    useService(name: string, service: Function, lifeTime?: LifeTime) {
        this.app.container.inject(name, service, lifeTime);
        return this;
    }

    runAsync(port = 8080) {
        return this.app.start(port);
    }
}