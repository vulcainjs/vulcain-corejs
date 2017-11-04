import { ExecutionResult } from './executionResult';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer, IInjectionNotification } from '../di/resolvers';
import { Inject } from '../di/annotations';
import { IMetrics, MetricsConstant } from '../metrics/metrics';
import { VulcainLogger } from '../log/vulcainLogger';
import { IRequestContext } from "../pipeline/common";
import { Span } from '../trace/span';

/**
 * command
 *
 * @export
 * @interface ICommand
 */
export interface ICommand {
    context: IRequestContext;
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

    /**
     *
     *
     * @type {RequestContext}
     */
    public context: IRequestContext;

    /**
     * Components container
     *
     * @readonly
     *
     * @memberOf AbstractCommand
     */
    @Inject(DefaultServiceNames.Container)
    container: IContainer;

    /**
     * Creates an instance of AbstractCommand.
     *
     * @param {IContainer} container
     * @param {any} providerFactory
     */
    constructor() {
    }

    protected setMetricsTags(tags: { [key: string]: string }) {
        Object.keys(tags)
            .forEach(key =>
            this.context.tracker.addTag(key, tags[key]));
    }

    // Must be defined in command
    // protected fallback(err, ...args)
}
