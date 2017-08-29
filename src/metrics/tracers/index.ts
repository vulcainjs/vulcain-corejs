/**
 * Request tracer interface
 */
import { ZipkinInstrumentation } from './zipkinInstrumentation';
import { IContainer } from '../../di/resolvers';
import { IRequestContext } from "../../pipeline/common";

export interface IRequestTracer {
    endTrace(tracer, result);
    traceCommand(tracer, verb: string);
}

export interface IRequestTracerFactory {
    startTrace(ctx: IRequestContext): IRequestTracer;    
}

export class TracerFactory {
    static create(container: IContainer): IRequestTracerFactory {
        return ZipkinInstrumentation.create();
    }
}