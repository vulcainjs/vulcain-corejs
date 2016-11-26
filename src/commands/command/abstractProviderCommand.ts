import {Schema} from '../../schemas/schema';
import {IProvider} from '../../providers/provider';
import {DefaultServiceNames} from '../../di/annotations';
import {IContainer} from '../../di/resolvers';
import {Domain} from '../../schemas/schema';
import {Inject} from '../../di/annotations';
import { IMetrics, MetricsConstant } from '../../metrics/metrics';
import { ProviderFactory } from '../../providers/providerFactory';
import { RequestContext } from '../../servers/requestContext';
import { System } from '../../configurations/globals/system';

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T
 */
export abstract class AbstractProviderCommand<T> {

    private providerFactory: ProviderFactory;

    protected metrics: IMetrics;

    /**
     *
     *
     * @type {RequestContext}
     */
    public requestContext: RequestContext;

    get container() {
        return this.requestContext.container;
    }
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

    private static METRICS_NAME = "database_io_";

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor(
        @Inject(DefaultServiceNames.Container) container: IContainer) {
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
            this.provider = await this.providerFactory.getProviderAsync(this.requestContext.container, this.requestContext.tenant, this.schema);
            this.initializeMetricsInfo();
        }
    }

    protected initializeMetricsInfo() {
        this.setMetricsTags(this.provider.address, this.schema.name);
    }

    protected setMetricsTags(address: string, schema: string) {
        let exists = System.manifest.dependencies.databases.find(db => db.address === address && db.schema === db.schema);
        if (!exists) {
            System.manifest.dependencies.databases.push({ address, schema });
        }
        this.metrics.setTags("host=" + address, "schema=" + schema);
    }

    onCommandCompleted(duration: number, success: boolean) {
        if (this.schema && this.provider) {
            this.metrics.timing(AbstractProviderCommand.METRICS_NAME + MetricsConstant.duration, duration);
            this.metrics.increment(AbstractProviderCommand.METRICS_NAME + MetricsConstant.total);
            if (!success)
                this.metrics.increment(AbstractProviderCommand.METRICS_NAME + MetricsConstant.failure);
        }
    }

    /**
     * execute command
     * @protected
     * @abstract
     * @param {any} args
     * @returns {Promise<T>}
     */
    abstract runAsync(...args): Promise<T>;

    // Must be defined in command
   // protected fallbackAsync(err, ...args)
}
