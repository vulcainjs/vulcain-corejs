/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { TrackerId, SpanKind } from '../../trace/common';
import { JaegerInstrumentation } from './JaegerInstrumentation';

export interface IRequestTracker {
    trackError(error);
    addTag(name: string, value: string);
    finish();
}

export interface IRequestTrackerFactory {
    startSpan( ctx: IRequestContext, id: TrackerId, name: string, kind: SpanKind, action: string): IRequestTracker;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ZipkinInstrumentation.create() ||
        /*ApplicationInsightsMetrics.create() || */
        JaegerInstrumentation.create();
    }
}