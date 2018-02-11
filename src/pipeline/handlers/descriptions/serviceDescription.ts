import { OperationDescription } from "./operationDescription";
import { SchemaDescription } from "./schemaDescription";
import { Model } from "../../../schemas/builder/annotations.model";
import { Metadata } from "../../../utils/reflector";

@Model()
@Metadata("system", true)        
export class ServiceDescription {
    domain: string;
    serviceName: string;
    serviceVersion: string;
    alternateAddress?: string;
    services: Array<OperationDescription>;
    schemas: Array<SchemaDescription>;
    hasAsyncTasks: boolean;
    scopes: Array<{ name: string, description: string }>;
}