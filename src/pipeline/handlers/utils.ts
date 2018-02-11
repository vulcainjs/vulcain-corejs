import { Schema } from '../../schemas/schema';
import { Domain } from '../../schemas/domain';
import { IContainer } from '../../di/resolvers';
import { ServiceDescriptors } from './descriptions/serviceDescriptions';

export class Utils {

// Get registered metadata by reverse hierarchy order
// to override base metadata
static getMetadata(key, target) {
    let metadata;
    if (target) {
        metadata = Utils.getMetadata(key, Object.getPrototypeOf(target));
        let tmp = Reflect.getOwnMetadata(key, target);
        if (tmp) {
            // merge
            metadata = Object.assign(metadata, tmp);
        }
    }
    return metadata || {};
}
    static obfuscateSensibleData(domain: Domain, container: IContainer, result?: any) {
        if (result) {
            if (Array.isArray(result)) {
                let outputSchema: Schema | null;
                result.forEach(v => {
                    if (v._schema) {
                        if (!outputSchema || outputSchema.name !== v._schema)
                            outputSchema = domain.getSchema(v._schema);
                        if (outputSchema && outputSchema.info.hasSensibleData)
                            outputSchema.obfuscate(v);
                    }
                });
            }
            else if (result._schema) {
                let outputSchema = domain.getSchema(result._schema);
                if (outputSchema && outputSchema.info.hasSensibleData)
                    outputSchema.obfuscate(result);
            }
        }

        return result;
    }

    static resolveType(type): string {
        if (typeof type === "function" && ServiceDescriptors.nativeTypes.indexOf(type.name.toLowerCase()) >= 0)
            return type.name;
        return type;
    }
}