import { Schema } from '../schemas/schema';
import { IProvider } from '../providers/provider';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer } from '../di/resolvers';
import { Domain } from '../schemas/schema';
import { Inject } from '../di/annotations';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { ProviderFactory } from '../providers/providerFactory';
import { System } from '../globals/system';
import { VulcainLogger } from '../log/vulcainLogger';
import { RequestContext } from "../pipeline/requestContext";

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T schema
 */
export abstract class AbstractProviderCommand<T> {

    protected providerFactory: ProviderFactory;
    private logger: VulcainLogger;
    protected metrics: IMetrics;
    private customTags: any;
    private commandTracker: any;

    /**
     *
     *
     * @type {RequestContext}
     */
    public requestContext: RequestContext;

    /**
     *
     *
     * @type {IProvider<T>}
     */
    provider: IProvider<T>;
    /**
     *
     *
     * @type {Schema}
     */
    schema: Schema;

    private static METRICS_NAME = "database_io";

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor(
        @Inject(DefaultServiceNames.Container) public container: IContainer) {
        this.providerFactory = container.get<ProviderFactory>(DefaultServiceNames.ProviderFactory);
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);
    }

    /**
     *
     *
     * @param {string} schema
     */
    async setSchemaAsync(schema: string): Promise<any> {
        if (schema && !this.provider) {
            this.schema = this.container.get<Domain>(DefaultServiceNames.Domain).getSchema(schema);
            this.provider = await this.providerFactory.getProviderAsync(this.requestContext, this.requestContext.security.tenant);
            this.initializeMetricsInfo();
        }
    }

    protected initializeMetricsInfo() {
        this.setMetricsTags(this.provider.address, this.schema.name, null, false);
    }

    protected setMetricsTags(address: string, schema: string, tenant?: string, emitLog = true) {
        address = System.removePasswordFromUrl(address);
        let exists = System.manifest.dependencies.databases.find(db => db.address === address && db.schema === db.schema);
        if (!exists) {
            System.manifest.dependencies.databases.push({ address, schema });
        }
        this.customTags = { address: address, schema: schema, tenant: (tenant || this.requestContext.security.tenant) };

        if (emitLog) {
            this.logger = this.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            this.logger.logAction(this.requestContext, "BC", "Database", `Command: ${Object.getPrototypeOf(this).constructor.name} - Access database ${System.removePasswordFromUrl(address)}`);
            this.commandTracker = this.requestContext.metrics && this.requestContext.metrics.startCommand(`Database request: ${schema}`, address);
        }
    }

    onCommandCompleted(duration: number, error?: Error) {
        if (this.schema && this.provider) {
            this.metrics.timing(AbstractProviderCommand.METRICS_NAME + MetricsConstant.duration, duration, this.customTags);
            if (error)
                this.metrics.increment(AbstractProviderCommand.METRICS_NAME + MetricsConstant.failure, this.customTags);
        }
        this.logger && this.logger.logAction(this.requestContext, 'EC', 'Database', `Command: ${Object.getPrototypeOf(this).constructor.name} completed with ${error ? 'success' : 'error'}`);
        this.requestContext.metrics && this.requestContext.metrics.finishCommand(this.commandTracker, error);
    }

    /**
     * execute command
     * @protected
     * @abstract
     * @param {any} args
     * @returns {Promise<T>}
     */
    abstract runAsync(...args);

    // Must be defined in command
    // protected fallbackAsync(err, ...args)
}
