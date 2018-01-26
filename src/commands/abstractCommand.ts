import { ExecutionResult } from './executionResult';
import { DefaultServiceNames } from '../di/annotations';
import { IContainer, IInjectionNotification } from '../di/resolvers';
import { Inject } from '../di/annotations';
import { IMetrics } from '../instrumentations/metrics';
import { VulcainLogger } from '../log/vulcainLogger';
import { IRequestContext } from "../pipeline/common";
import { Span } from '../instrumentations/span';
import { ISpanTracker } from '../instrumentations/common';

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

    protected setMetricsTags(command: string, tags: { [key: string]: string }) {
        let tracker = <ISpanTracker>this.context.requestTracker;
        tracker.trackAction(command);

        Object.keys(tags)
            .forEach(key =>
            tracker.addTag(key, tags[key]));
    }

    // Must be defined in command
    // protected fallback(err, ...args)
}
