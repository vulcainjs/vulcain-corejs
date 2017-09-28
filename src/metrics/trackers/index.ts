/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { ApplicationInsightsMetrics } from '../applicationInsightsMetrics';
import { SpanId, SpanKind } from '../../trace/common';

export interface IRequestTracker {
    trackError(error);
    dispose(duration: number, tags);
}

export interface IRequestTrackerFactory {
    startSpan( ctx: IRequestContext, id: SpanId, name: string, kind: SpanKind, action: string): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ApplicationInsightsMetrics.create() ||
            ZipkinInstrumentation.create();
    }
}