import { ExecutionResult } from './executionResult';
import { DefaultServiceNames } from '../../di/annotations';
import { IContainer } from '../../di/resolvers';
import { Inject } from '../../di/annotations';
import { RequestContext } from '../../servers/requestContext';
import { IMetrics } from '../../metrics/metrics';

/**
 * command
 *
 * @export
 * @interface ICommand
 */
export interface ICommand {
    /**
     * execute the command
     * @param args
     */
    executeAsync<T>(...args): Promise<T>;
    /**
     * execution result
     */
    status: ExecutionResult;
}

/**
 *
 *
 * @export
 * @abstract
 * @class AbstractCommand
 * @template T
 */
export abstract class AbstractCommand<T> {
    protected metrics: IMetrics;
    protected customTags: string;

    /**
     *
     *
     * @type {RequestContext}
     */
    public requestContext: RequestContext;

    /**
     * Components container
     *
     * @readonly
     *
     * @memberOf AbstractCommand
     */
    get container() {
        return this.requestContext.container;
    }

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor( @Inject(DefaultServiceNames.Container) container: IContainer) {
        this.metrics = container.get<IMetrics>(DefaultServiceNames.Metrics);
    }

    protected setMetricsTags(...args: Array<string>) {
        this.customTags = this.metrics.encodeTags(...args);
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
