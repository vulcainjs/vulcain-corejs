import './preloader'; // First
import { IServiceResolver } from './configurations/globals/serviceResolver';

// Configurations
export { VulcainManifest, ServiceDependency, HttpDependency, ConfigurationProperty } from './configurations/dependencies/annotations';
export { DynamicConfiguration } from './configurations/dynamicConfiguration';
export { IDynamicProperty } from './configurations/dynamicProperty';
export { MemoryConfigurationSource } from './configurations/configurationSources/memoryConfigurationSource';
export { FileConfigurationSource } from './configurations/configurationSources/fileConfigurationSource';
export { ConfigurationDataType } from './configurations/configurationSources/configurationSource';
export { VulcainLogger } from './configurations/log/vulcainLogger';
export { System } from './configurations/globals/system';
export { IServiceResolver } from './configurations/globals/serviceResolver';
export { HttpConfigurationSource } from './configurations/configurationSources/httpConfigurationSource';

// Schemas
export * from './schemas/schema'
export { ModelOptions, Model, Property, Reference, PropertyOptions, ReferenceOptions, Validator, ISchemaTypeDefinition, SchemaTypeDefinition } from './schemas/annotations'
export { SchemaStandardTypes, SchemaStandardValidators } from './schemas/standards';

// Auth
export {SecurityManager, VerifyTokenParameter, ITokenService} from './security/securityManager'
export { StsTokenService } from './security/services/stsTokenService';
export { StsAuthentication } from './security/stsAuthentications';

// Core
export * from './application'
export { Conventions } from './utils/conventions';
export { IMetrics } from './metrics/metrics';
export { IMockManager } from './mocks/imockManager';
export { MockManager } from './mocks/mockManager';
export { IRequestTracer } from './metrics/tracers/index';

// Pipeline
export * from './pipeline/handlers/annotations';
export { QueryHandler, ActionHandler, EventHandler } from './pipeline/handlers/annotations.handlers';
export { ActionMetadata, ActionHandlerMetadata } from './pipeline/handlers/actions';
export { EventNotificationMode,  ConsumeEventMetadata, EventMetadata, EventData } from './pipeline/handlers/messageBus';
export { QueryActionMetadata, QueryMetadata } from './pipeline/handlers/query';
export { AbstractActionHandler, AbstractEventHandler, AbstractQueryHandler } from './pipeline/handlers/abstractHandlers';
export { RequestData, IRequestContext, Pipeline } from './pipeline/common';
export { HttpResponse, HttpRedirectResponse } from './pipeline/response';
export { ScopesDescriptor, ScopeDescription } from './defaults/scopeDescriptors';
export { ValidationError } from './pipeline/errors/validationError';

export { HttpRequest } from './pipeline/vulcainPipeline';
export { Logger } from './configurations/log/logger'
export { UserContext, } from './security/securityManager'
export { DefaultActionHandler, DefaultQueryHandler, DefaultRepositoryCommand } from './defaults/crudHandlers';

// Bus adapter
export * from './bus/busAdapter'
export * from './bus/rabbitAdapter'

// Providers
export { IProvider, ListOptions } from './providers/provider'
export * from './providers/memory/provider'
export * from './providers/mongo/provider'
export { ProviderFactory } from './providers/providerFactory';

// Containers
export { IContainer, IInjectionNotification } from './di/resolvers';
//export { TestContainer } from './di/containers';
export { Inject, Injectable, LifeTime, DefaultServiceNames, IScopedComponent } from './di/annotations';
// TODO export { TestContext } from './di/testContext';

// Errors
export { ApplicationRequestError, ForbiddenRequestError, UnauthorizedRequestError, NotFoundError } from './pipeline/errors/applicationRequestError';
export { BadRequestError } from './pipeline/errors/badRequestError';
export { CommandRuntimeError } from './pipeline/errors/commandRuntimeError';
export { RuntimeError } from './pipeline/errors/runtimeError';
export { HttpCommandError } from './commands/abstractServiceCommand';

// Commands
export { Command, CommandFactory } from './commands/commandFactory';
export { EventType, FailureType, ExecutionResult } from './commands/executionResult';
export { AbstractCommand, ICommand } from './commands/abstractCommand';
export { HystrixSSEStream } from './commands/http/hystrixSSEStream';
export { IHttpCommandRequest, IHttpCommandResponse } from './commands/types';
export { AbstractServiceCommand } from './commands/abstractServiceCommand';
export { AbstractHttpCommand } from './commands/abstractHttpCommand';
export { AbstractProviderCommand } from './commands/abstractProviderCommand';
export { IHasFallbackCommand } from './commands/command';