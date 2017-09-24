import { Inject, DefaultServiceNames } from '../../di/annotations';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/schema';
import { Model } from '../../schemas/annotations';
import { DefinitionsObject, SwaggerApiDefinition, TagObject, PathsObject, PathItemObject, OperationObject, Parameters, ParameterObject } from './swaggerApiDefinition';
import { IScopedComponent } from '../../di/annotations';
import { IRequestContext } from '../../pipeline/common';
import { ServiceDescription, ActionDescription, SchemaDescription, PropertyDescription } from '../../pipeline/handlers/serviceDescriptions';
import { Conventions } from '../../utils/conventions';


export class SwaggerServiceDescriptor implements IScopedComponent {
    requestContext: IRequestContext;

    private static defaultDefinitionType: string = "object";

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) {
    }

    async getDescriptionsAsync(serviceDescription: ServiceDescription) {
        let descriptions = this.initialize();

        descriptions.info.version = serviceDescription.serviceVersion;
        descriptions.info.title = serviceDescription.serviceName;
        descriptions.tags = this.computeTags(serviceDescription.services);
        descriptions.definitions = this.computeDefinitions(serviceDescription.schemas);
        descriptions.paths = this.computePaths(serviceDescription);
        descriptions.host = this.requestContext.hostName;
        descriptions.basePath = Conventions.instance.defaultUrlprefix;

        descriptions.definitions['_errorResponse'] = this.createResponseDefinition({
            error: {
                type: "object",
                properties: {
                    message: { type: 'string' },
                    errors: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                message: { type: "string" },
                                id: { type: "string" },
                                field: { type: "string" }
                            }
                        }
                    }
                }
            }
        });

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
            basePath: Conventions.instance.defaultUrlprefix,
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
            let parts = service.verb.split('.');
            if(parts.length === 2)
                tagsSet.add(parts[0]);
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
    private computePaths(serviceDescription: ServiceDescription): PathsObject {
        let paths: PathsObject = {};

        serviceDescription.services.forEach((service: ActionDescription) => {
            let operationObject: OperationObject = {};

            //TODO : put this split hack into method
            operationObject.tags = [service.verb.split('.')[0]];
            operationObject.summary = service.description;
            operationObject.description = service.description;
            if(service.inputSchema)
                operationObject.consumes = ['application/json'];
            operationObject.produces = ['application/json'];
            operationObject.parameters = this.computeParameters(serviceDescription.schemas, service);
            this.computeResponses(service, operationObject);

            paths[`/${service.verb}`] = {
                [service.kind === 'action' ? 'post' : 'get']: operationObject
            };
        });

        return paths;
    }

    createResponseDefinition(payload?: any): any {
        let res = {
            type: 'object',
            properties: {
                meta: {
                    type: "object",
                    properties: {
                        correlationId: { type: 'string' }
                    }
                }
            }
        };
        if( payload)
            res.properties = Object.assign(res.properties, payload);
        return res;
    }

    private computeResponses(service: ActionDescription, operationObject: OperationObject) {

        operationObject.responses = {};

        operationObject.responses['400'] = { description: 'Invalid input', schema: { $ref: '#/definitions/_errorResponse' } };

        if (service.scope !== '?') {
            operationObject.responses['401'] = { description: 'Not authentified' };
            operationObject.responses['403'] = { description: 'Not authorized' };
        }

        operationObject.responses['500'] = { description: 'Handler exception', schema: { $ref: '#/definitions/_errorResponse' } };

        if (service.async) {
            operationObject.responses['200'] = {
                description: 'Processing task',
                schema: this.createResponseDefinition({
                    meta: {
                        type: "object",
                        properties: { status: { type: "string" }, taskId: { type: "string" } }
                    }
                })
            };
        }
        else {
            operationObject.responses['200'] = {
                description: 'Successful operation',
                schema: this.createResponseDefinition()
            };
            if (service.outputSchema) {
                operationObject.responses['200'].schema.properties.value = {};
                this.setReferenceDefinition(operationObject.responses['200'].schema.properties.value, service.outputSchema, service.outputType);
            }
        }
    }

    /**
     * Format the json parameters object for swagger
     *  See the documentation here: http://swagger.io/specification/#parameterObject
     * @param service
     */
    private computeParameters(schemas: SchemaDescription[], service: ActionDescription): Parameters {
        if (service.kind === 'get') {
            let parameters: ParameterObject = {};
            parameters.name = 'id';
            parameters.in = 'query';
            parameters['schema'] = { 'type': 'string' };
            parameters.required = true;
            return [parameters];
        }
        else if (service.kind === 'query') {
            let parms = [];
            if (service.inputSchema) {
                let schema = schemas.find(sch => sch.name === service.inputSchema);
                if (schema) {
                    schema.properties.forEach((property: PropertyDescription) => {
                        let parameters: ParameterObject = {};
                        parameters.name = property.name;
                        parameters.description = property.description;
                        parameters['in'] = 'query';
                        parameters.required = property.required;
                        parameters['schema'] = { type: property.type };
                        parms.push(parameters);
                    });
                }
            }
            return parms.concat([
            {
                name: '$page',
                in: 'query',
                schema: { 'type': 'number' },
                required: false
            },
            {
                name: '$maxByPage',
                in: 'query',
                schema : { 'type': 'number' },
                required : false
            }]);
        }
        else if (service.inputSchema) {
            let parameters: ParameterObject = {};
            parameters.name = 'args';
            parameters['in'] = 'body';
            parameters.required = true;
            parameters['schema'] = {};
            this.setReferenceDefinition(parameters['schema'], service.inputSchema);
            return [parameters];
        }
        return [];
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

            currentDef[schema.name] = {
                type: SwaggerServiceDescriptor.defaultDefinitionType,
                properties: this.createDefinition(schema)
            };
        });
        return currentDef;
    }

    private createDefinition(schema: SchemaDescription) {
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
        return jsonSchema.properties;
    }

    private setReferenceDefinition(desc, definitionName: string, propertyReference = 'one') {

        if (propertyReference === 'one') {
            if (definitionName !== 'any') {
                if (this.isFundamentalObject(definitionName)) {
                    desc['type'] = definitionName;
                } else {
                    desc['type'] = 'object';
                    desc['$ref'] = `#/definitions/${definitionName}`;
                }
            }
        } else {
            // is a 'many' outputType
            desc['type'] = 'array';
            let def = definitionName;
            let pos = def.indexOf('[]');
            if (pos > 0)
                def = def.substr(0, pos); // remove final []

            if (def !== 'any') {
                let items = desc['items'] = {};
                if (this.isFundamentalObject(def)) {
                    items['type'] = def;
                } else {
                    items['type'] = 'object';
                    items['$ref'] = `#/definitions/${def}`;
                }
            }
        }
    }

    private isFundamentalObject(inputSchema: string) {
        let type = this.domain._findType(inputSchema);
        if (!type)
            return false;
        return this.domain.getBaseType(type);
    }

}
