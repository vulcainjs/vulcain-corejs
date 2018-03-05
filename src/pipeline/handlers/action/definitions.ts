import { MessageBus, EventNotificationMode, ConsumeEventDefinition, EventData } from '../../../bus/messageBus';
import { IContainer } from '../../../di/resolvers';
import { Domain } from '../../../schemas/domain';
import { DefaultServiceNames } from '../../../di/annotations';
import { ServiceDescriptors, Handler } from '../descriptions/serviceDescriptions';
import { Service } from '../../../globals/system';
import { RequestContext } from "../../../pipeline/requestContext";
import { RequestData, Pipeline, ICustomEvent } from "../../../pipeline/common";
import { CommandRuntimeError } from "../../errors/commandRuntimeError";
import { UserContextData } from "../../../security/securityContext";
import { HttpResponse } from "../../response";
import { ApplicationError } from "../../errors/applicationRequestError";
import { BadRequestError } from "../../errors/badRequestError";
import { ITaskManager } from "../../../providers/taskManager";
import { IRequestContext } from '../../../index';
import { HandlerProcessor } from '../../handlerProcessor';
import { EventHandlerFactory } from './eventHandlerFactory';
import { HandlerDefinition, OperationDefinition } from '../definitions';

export interface ExposeEventDefinition {
    schema?: string;
    mode?: EventNotificationMode;
    factory?: (context: IRequestContext, event: EventData) => EventData;
    options?: any;
}

/**
 * Declare default action handler definition
 *
 * @export
 * @interface ActionHandlerMetadata
 * @extends {HandlerDefinition}
 */
export interface ActionHandlerDefinition extends HandlerDefinition {
    /**
     *
     *
     * @type {boolean}
     * @memberOf ActionHandlerMetadata
     */
    async?: boolean;
    /**
     *
     *
     * @type {EventNotificationMode}
     * @memberOf ActionHandlerMetadata
     */
    eventMode?: EventNotificationMode;
}

/**
 *
 *
 * @export
 * @interface ActionMetadata
 * @extends {CommonActionMetadata}
 */
export interface ActionDefinition extends OperationDefinition {
    skipDataValidation?: boolean;
    async?: boolean;
    eventDefinition?: ExposeEventDefinition;
}
