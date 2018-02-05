import {IContainer} from '../../di/resolvers';
import {LifeTime} from '../../di/annotations';
import {Domain} from '../../schemas/domain';
import { RequestData } from "../../pipeline/common";
import { HttpResponse } from "../response";
import { RequestContext } from '../requestContext';
import { Schema } from '../../index';
import { Handler } from './descriptions/serviceDescriptions';

export interface OperationDefinition {
    description: string;
    name?: string;
    scope?: string;
    schema?: string;
    inputSchema?: string;
    outputSchema?: string;
    outputCardinality?: "one" | "many";
    metadata?: any;
}

export interface HandlerDefinition {
    description?: string;
    schema?: string;
    metadata?: any;
    scope: string;
    serviceName?: string;
    serviceLifeTime?: LifeTime;
    enableOnTestOnly?: boolean;
}

export interface IManager {
    container: IContainer;
    run(info: Handler, command: RequestData, ctx: RequestContext): Promise<HttpResponse>;
}


