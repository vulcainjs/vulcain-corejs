import { System } from '../globals/system';

export interface IServiceResolver {
    resolve(serviceName: string, version: string): Promise<string>;
}

export class ServiceResolver implements IServiceResolver {
        /**
     *
     *
     * @private
     * @param {string} serviceName
     * @param {number} version
     * @returns
     */
    resolve(serviceName: string, version: string) {
        if (!serviceName)
            throw new Error("You must provide a service name");
        if (!version || !version.match(/[0-9]+\.[0-9]+/))
            throw new Error("Invalid version number. Must be on the form major.minor");

        return Promise.resolve(System.createContainerEndpoint(serviceName, version));
    }
}