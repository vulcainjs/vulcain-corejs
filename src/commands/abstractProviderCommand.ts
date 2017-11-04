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
import { IRequestContext } from "../pipeline/common";
import { Span } from '../trace/span';

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

    public context: IRequestContext;

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

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor(
        @Inject(DefaultServiceNames.Container) public container: IContainer) {
        this.providerFactory = container.get<ProviderFactory>(DefaultServiceNames.ProviderFactory);
    }

    /**
     *
     *
     * @param {string} schema
     */
    setSchema(schema: string): string {
        if (schema && !this.provider) {
            this.schema = this.container.get<Domain>(DefaultServiceNames.Domain).getSchema(schema);
            this.provider = this.providerFactory.getProvider(this.context, this.context.user.tenant);
            return this.schema.name;
        }
    }

    protected setMetricTags(address: string, schema: string, tenant?: string) {
        System.manifest.registerProvider(address, schema);
        this.context.tracker.addProviderCommandTags( address,  schema, (tenant || this.context.user.tenant) );
    }

    // Must be defined in command
    // protected fallback(err, ...args)
}
