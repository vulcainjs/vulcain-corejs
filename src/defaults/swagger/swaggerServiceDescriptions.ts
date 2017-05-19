import { Inject, DefaultServiceNames } from '../../di/annotations';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/schema';
import { Model } from '../../schemas/annotations';
import { ServiceDescriptors, ServiceDescription, SchemaDescription, PropertyDescription, ActionDescription } from '../../pipeline/serviceDescriptions';
import { DefinitionsObject, SwaggerApiDefinition, TagObject, PathsObject, PathItemObject, OperationObject, Parameters, ParameterObject } from './swaggerApiDefinition';
import { IScopedComponent } from '../../di/annotations';
import { RequestContext } from '../../servers/requestContext';


export class SwaggerServiceDescriptor implements IScopedComponent {
    requestContext: RequestContext;

    private static defaultDefinitionType: string = "object";

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) {
    }

    async getDescriptionsAsync(serviceDescription: ServiceDescription) {
        let descriptions = this.initialize();

        descriptions.info.version = serviceDescription.serviceVersion;
        descriptions.info.title = serviceDescription.serviceName;
        descriptions.tags = this.computeTags(serviceDescription.services);
        descriptions.paths = this.computePaths(serviceDescription.services);
        descriptions.definitions = this.computeDefinitions(serviceDescription.schemas);
        descriptions.host = this.requestContext.hostName;
        descriptions.basePath = '/api';

        descriptions.definitions['_BadRequestError'] = this.createResponseDefinition({ error: { message: { type: 'string' } } });

        return descriptions;
    }

    private initialize(): SwaggerApiDefinition {
        return {
            swagger: '2.0',
            info: {
                'version': '1.0.0',
                'title': this.domain.name
            },
            schemes: [
                'http'
            ],
            paths: {},
            definitions: {}
        };
    }

    /**
     * Getting all endpoint Handler (only the first word)
     * Example : {verb : "customer.myAction" } it's `customer` who is kept
     * @param services
     * @return string[]
     */
    private computeTags(services: Array<ActionDescription>): TagObject[] {
        let tags: TagObject[] = [];

        let tagsSet = new Set();


        services.forEach((service: ActionDescription) => {
            //service.verb = 'customer.myAction'
            // with split we kept only 'customer'
            //split for getting first word
            tagsSet.add(service.verb.split('.')[0]);
        });

        let allTags = [...tagsSet];

        tags = <TagObject[]>allTags.map((tag) => {
            return {
                name: tag,
                description: ''
            };
        });

        return tags;
    }

    /**
     * Format the path to swagger json format.
     * See the documentation here : http://swagger.io/specification/#pathsObject
     * @param services
     */
    private computePaths(services: Array<ActionDescription>): PathsObject {
        let paths: PathsObject = {};

        services.forEach((service: ActionDescription) => {
            let operationObject: OperationObject = {};

            //TODO : put this split hack into method
            operationObject.tags = [service.verb.split('.')[0]];
            operationObject.summary = service.description;
            operationObject.description = service.description;
            operationObject.consumes = ['application/json'];
            operationObject.produces = ['application/json'];
            operationObject.parameters = this.computeParameters(service);

            this.computeResponses(service, operationObject);

            if (service.kind === 'action') {
                paths['/' + service.verb] = {
                    post: operationObject
                };
            } else {
                paths['/' + service.verb] = {
                    get: operationObject
                };
            }
        });

        return paths;
    }

    createResponseDefinition(payload: any): any {
        let res = {
            type: 'object',
            properties: {
                tenant: { type: 'string' },
                correlationId: { type: 'string' },
                source: { type: 'string' }
            }
        };
        res.properties = Object.assign(res.properties, payload);
        return res;
    }


    private computeResponses(service: ActionDescription, operationObject: OperationObject) {

        operationObject.responses = {};

        operationObject.responses['400'] = { description: 'Invalid input', schema: { $ref: '#/definitions/_BadRequestError' } };

        if (service.scope !== '?') {
            operationObject.responses['401'] = { description: 'Not authentified' };
            operationObject.responses['403'] = { description: 'Not authorized' };
        }

        operationObject.responses['500'] = { description: 'Handler exception', schema: { $ref: '#/definitions/_BadRequestError' } };

        if (service.async) {
            operationObject.responses['200'] = { description: 'Processing task', schema: { $ref: '#/definitions/_BadRequestError' } };
        }
        else {
            operationObject.responses['200'] = { description: 'Successful operation', schema: this.createResponseDefinition({ value: {} }) };

            if (service.outputSchema) {
                this.setReferenceDefinition(operationObject.responses['200'].schema.properties.value, service.outputSchema, service.outputType);
            }
        }
    }

    /**
     * Format the json parameters object for swagger
     *  See the documentation here: http://swagger.io/specification/#parameterObject
     * @param service
     */
    private computeParameters(service: ActionDescription): Parameters {
        let parameters: ParameterObject = {};
        if (service.kind === 'get') {
            parameters.name = 'id';
            parameters.in = 'query';
            parameters['type'] = 'string';
            parameters.required = true;
        }
        else if (service.inputSchema) {
            parameters.name = 'args';
            if (service.kind === 'action') {
                parameters['in'] = 'body';
                this.setReferenceDefinition(parameters, service.inputSchema);
            } else {
                parameters['in'] = 'query';
                parameters.required = true;
                parameters['type'] = 'string'; // TODO destructure schema
            }
        }

        return [<Parameters>parameters];
    }

    /**
     * Format the json definitions for swagger type
     * See the documentation here : http://swagger.io/specification/#definitionsObject
     * @param schemas
     * @return DefinitionObject
     */
    private computeDefinitions(schemas: Array<SchemaDescription>): DefinitionsObject {
        let definitions = {};
        let currentDef: DefinitionsObject = {};
        schemas.forEach((schema: SchemaDescription) => {

            let jsonSchema = {
                properties: {}
            };

            schema.properties.forEach((property: PropertyDescription) => {
                jsonSchema.properties[property.name] = {
                    type: property.type
                };

                if (property.reference === 'one' || property.reference === 'many') {
                    this.setReferenceDefinition(jsonSchema.properties[property.name], property.type, property.reference);
                }

                if (property.description) {
                    jsonSchema.properties[property.name].description = property.description;
                }

                if (property.required) {
                    jsonSchema.properties[property.name].required = property.required;
                }

            });

            currentDef[schema.name] = {
                type: SwaggerServiceDescriptor.defaultDefinitionType,
                properties: jsonSchema.properties
            };
        });
        return currentDef;
    }


    private setReferenceDefinition(desc, definitionName, propertyReference = 'one') {

        if (propertyReference === 'one') {
            if (this.isFundamentalObject(definitionName)) {
                desc['type'] = definitionName;
            } else {
                desc['type'] = 'object';
                desc['$ref'] = `#/definitions/${definitionName}`;
            }
        } else {
            // is a 'many' outputType
            desc['type'] = 'array';
            desc['items'] = {
                '$ref': `#/definitions/${definitionName}`
            };

        }

    }

    private isFundamentalObject(inputSchema: string) {
        return ['string', 'number', 'boolean'].indexOf(inputSchema) !== -1;
    }

}
