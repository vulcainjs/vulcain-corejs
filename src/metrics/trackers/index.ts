/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";

export interface IRequestTracker {
    injectTraceHeaders(span, headers: (name: string | any, value?: string) => any);
    finish(result);
    startCommand(command: string, target?: string): any;
    finishCommand(span, status);
    trackError(error, id?);
}

export interface IRequestTrackerFactory {
    startSpan(ctx: IRequestContext): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ZipkinInstrumentation.create();
    }
}