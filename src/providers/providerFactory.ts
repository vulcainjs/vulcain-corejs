import { Injectable, LifeTime, Inject } from '../di/annotations';
import { DefaultServiceNames } from '../di/annotations';
import { Schema } from '../schemas/schema';
import { IProvider } from './provider';
import { IContainer } from '../di/resolvers';
import { HandlerItem } from '../pipeline/serviceDescriptions';
import { System } from '../configurations/globals/system';
import { RequestContext } from '../servers/requestContext';

interface PoolItem {
    provider?: IProvider<any>;
    count?: number;
    dispose?: () => Promise<any>;
}

@Injectable(LifeTime.Singleton, DefaultServiceNames.ProviderFactory)
export class ProviderFactory {
    private pool = new Map<string, PoolItem>();

    constructor(public maxPoolSize = 20) {
    }

    private addToPool(key: string, item: PoolItem) {
        System.log.info(null, "Adding a new provider pool item : " + key);
        if (this.pool.size >= this.maxPoolSize) {
            // remove the least used
            let keyToRemove;
            let min = 0;
            for (const [key, value] of this.pool.entries()) {
                if (!keyToRemove || value.count < min) {
                    keyToRemove = key;
                    min = value.count;
                }
            }
            let item = this.pool.get(keyToRemove);
            item.dispose && item.dispose();
            this.pool.delete(keyToRemove);
            System.log.info(null, "Ejecting " + keyToRemove + " from provider pool item.");
        }
        item.count = 1;
        this.pool.set(key, item);
    }

    private getFromPool(key: string) {
        let item = this.pool.get(key);
        if (item) {
            item.count++;
            return item.provider;
        }
    }

    async getProviderAsync(context: RequestContext, tenant?: string, providerName: string = DefaultServiceNames.Provider) {
        tenant = tenant || context.tenant;
        let poolKey = providerName + "!" + tenant;
        let provider = this.getFromPool(poolKey);
        if (provider) {
            return provider;
        }
        else {
            provider = context.container.get<IProvider<any>>(providerName, false, LifeTime.Transient);
            let item: PoolItem = {provider};
            item.dispose = await provider.initializeTenantAsync(tenant);
            this.addToPool(poolKey, item);
        }

        return provider;
    }
}