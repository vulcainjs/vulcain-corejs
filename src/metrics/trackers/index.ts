/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { SpanId } from '../../trace/span';

export interface IRequestTracker {
    trackTiming(duration: number, tags);
    trackDependency(tags);
    trackRequest(tags);
    trackError(error, tags);
    dispose(tags);
}

export interface IRequestTrackerFactory {
    startSpan( id: SpanId, name: string, tags): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ZipkinInstrumentation.create();
    }
}