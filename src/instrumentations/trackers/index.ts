/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";
import { TrackerId, SpanKind, ISpanTracker } from '../../instrumentations/common';
import { JaegerInstrumentation } from './JaegerInstrumentation';

export interface ITrackerAdapter {
    log(msg: string);
    trackError(error, msg?: string);
    addTag(name: string, value: string);
    finish();
}

export interface IRequestTrackerFactory {
    startSpan( span: ISpanTracker, name: string, action: string): ITrackerAdapter;
}

export class TrackerFactory {
    static create(container: IContainer): IRequestTrackerFactory {
        return ZipkinInstrumentation.create() ||
        /*ApplicationInsightsMetrics.create() || */
        JaegerInstrumentation.create();
    }
}