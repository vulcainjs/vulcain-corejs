/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { SpanId, SpanKind } from '../../trace/span';
import { ApplicationInsightsMetrics } from '../applicationInsightsMetrics';

export interface IRequestTracker {
    trackError(error, tags);
    dispose(duration: number, tags);
}

export interface IRequestTrackerFactory {
    startSpan( ctx: IRequestContext, id: SpanId, name: string, kind: SpanKind, action: string, tags): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ApplicationInsightsMetrics.create() ||
            ZipkinInstrumentation.create();
    }
}