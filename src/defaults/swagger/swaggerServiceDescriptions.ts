import { Inject, DefaultServiceNames } from '../../di/annotations';
import { IContainer } from '../../di/resolvers';
import { Domain } from '../../schemas/schema';
import { Model } from '../../schemas/annotations';
import { DefinitionsObject, SwaggerApiDefinition, TagObject, PathsObject, PathItemObject, OperationObject, Parameters, ParameterObject } from './swaggerApiDefinition';
import { IScopedComponent } from '../../di/annotations';
import { IRequestContext } from '../../pipeline/common';
import { ServiceDescription, ActionDescription, SchemaDescription, PropertyDescription } from '../../pipeline/handlers/serviceDescriptions';
import { Conventions } from '../../utils/conventions';
import { Service } from '../../index';


export class SwaggerServiceDescriptor implements IScopedComponent {
    context: IRequestContext;

    private static defaultDefinitionType: string = "object";

    constructor( @Inject(DefaultServiceNames.Container) private container: IContainer, @Inject(DefaultServiceNames.Domain) private domain: Domain) {
    }

    async getDescriptions(serviceDescription: ServiceDescription) {
        let descriptions = this.initialize();

        descriptions.info.version = serviceDescription.serviceVersion;
        descriptions.info.title = serviceDescription.serviceName;
        descriptions.tags = this.computeTags(serviceDescription.services);
        descriptions.definitions = this.computeDefinitions(serviceDescription.schemas);
        descriptions.paths = this.computePaths(serviceDescription);
        descriptions.host = this.context.hostName;
        descriptions.basePath = Conventions.instance.defaultUrlprefix;
        return descriptions;
    }

    private initialize(): SwaggerApiDefinition {
        return {
            swagger: '2.0',
            info: {
                'version': '1.0.0',
                'title': Service.fullServiceName
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
            if (service.action.startsWith("_"))
                return;
            let operationObject: OperationObject = {};

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

    createResponseDefinition(listResponse: boolean, payload?: any): any {
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

        if (listResponse) {
            (<any>res.properties.meta.properties).total = { type: 'number' };
            (<any>res.properties.meta.properties).maxByPage= { type: 'number' };
            (<any>res.properties.meta.properties).page= { type: 'number' };
        }

        if( payload)
            res.properties = Object.assign(res.properties, payload);
        return res;
    }

    private computeResponses(service: ActionDescription, operationObject: OperationObject) {

        operationObject.responses = {};

        operationObject.responses['400'] = {
            description: 'Invalid input',
            schema: {
                type: 'object',
                properties: {
                    meta: {
                        type: "object",
                        properties: {
                            correlationId: { type: 'string' }
                        }
                    },
                    error: {
                        type: "object",
                        properties: {
                            message: { type: 'string' },
                            errors: {
                                type: "object",
                                additionalProperties: {
                                    type: 'string'
                                },
                                example: {
                                    firstName: "FirstName is required",
                                    lastName: "lastName must be in upper case"
                                }
                            }
                        }
                    }
                }
            }
        };

        if (service.scope !== '?') {
            operationObject.responses['401'] = { description: 'Not authentified' };
            operationObject.responses['403'] = { description: 'Not authorized' };
        }

        operationObject.responses['500'] = {
            description: 'Invalid input',
            schema: {
                type: 'object',
                properties: {
                    meta: {
                        type: "object",
                        properties: {
                            correlationId: { type: 'string' }
                        }
                    },
                    error: {
                        type: "object",
                        properties: {
                            message: { type: 'string' }
                        }
                    }
                }
            }
        };

        if (service.async) {
            operationObject.responses['200'] = {
                description: 'Processing task',
                schema: this.createResponseDefinition(false, {
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
                schema: this.createResponseDefinition(service.kind === "query" && service.action === "all")
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
            let params = [
                {
                    name: 'id',
                    description: "Unique id",
                    in: 'path',
                    type: 'string',
                    required: true
                }
            ]
            return params;
        }
        else if (service.kind === 'query') {
            let parms = [];
            if (service.inputSchema) {
                let schema = schemas.find(sch => sch.name === service.inputSchema);
                if (schema) {
                    schema.properties.forEach((property: PropertyDescription) => {
                        let param: ParameterObject = {};
                        param.name = property.name;
                        param.description = property.description || property.typeDescription;
                        param['in'] = 'query';
                        param.required = property.required;
                        param['schema'] = { type: property.type, description: property.typeDescription };
                        parms.push(param);
                    });
                }
            }
            return parms.concat([
                {
                    name: '$query',
                    in: 'query',
                    description: "Filter query",
                    type: 'string',
                    required: false
                },
                {
                    name: '$page',
                    in: 'query',
                    description: "Skip to page",
                    type: 'number',
                    required: false
                },
                {
                    name: '$maxByPage',
                    in: 'query',
                    description: "Max items by page",
                    type: 'number',
                    required: false
                }
            ]);
        }
        else if (service.inputSchema) {
            let parameters: ParameterObject = {};
            parameters.name = 'args';
            parameters['in'] = 'body';
            parameters.required = true;
            parameters.description = "Argument";
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
                ...this.createDefinition(schema)
            };
        });
        return currentDef;
    }

    private createDefinition(schema: SchemaDescription) {
        let jsonSchema:any = {
            properties: {}
        };

        let required = [];
        schema.properties.forEach((property: PropertyDescription) => {
            jsonSchema.properties[property.name] = {
                type: property.type,
                description: property.typeDescription
            };

            if (property.reference === 'one' || property.reference === 'many') {
                this.setReferenceDefinition(jsonSchema.properties[property.name], property.type, property.reference);
            }

            if (property.description) {
                jsonSchema.properties[property.name].description = property.description;
            }

            if (property.required) {
                required.push(property.name);
            }
        });
        if (required.length)
            jsonSchema.required = required;

        return jsonSchema;
    }

    private setReferenceDefinition(desc, definitionName: string, propertyReference = 'one') {

        if (propertyReference === 'one') {
            if (definitionName !== 'any') {
                if (this.isFundamentalObject(definitionName)) {
                    desc['type'] = definitionName;
                } else {
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
                    items['$ref'] = `#/definitions/${def}`;
                }
            }
            else {
                desc.items = { type: 'object' };
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
