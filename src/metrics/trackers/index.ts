/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { SpanId, SpanKind } from '../../trace/span';

export interface IRequestTracker {
    trackError(error, tags);
    dispose(tags);
}

export interface IRequestTrackerFactory {
    startSpan( id: SpanId, name: string, kind: SpanKind, tags): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ZipkinInstrumentation.create();
    }
}