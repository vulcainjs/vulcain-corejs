import { Injectable, LifeTime, Inject } from '../../di/annotations';
import { DefaultServiceNames } from '../../di/annotations';
import { Schema } from '../../schemas/schema';
import { IProvider } from '../provider';
import { IContainer } from '../../di/resolvers';
import { Service } from '../../globals/system';
import { IRequestContext } from "../../pipeline/common";
import { MemoryProvider } from './provider';

interface PoolItem {
    provider?: MemoryProvider;
    count?: number;
    dispose?: () => void;
}

export class MemoryProviderFactory {
    private pool = new Map<string, PoolItem>();

    constructor(private dataFolder, public maxPoolSize = 20) {
    }

    private addToPool(context: IRequestContext, key: string, item: PoolItem) {
        Service.log.info(context, () => `Adding a new provider pool item : ${key}`);
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
            Service.log.info(context, () => `Ejecting ${keyToRemove} from provider pool item.`);
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

    getConnection<T=any>(context: IRequestContext, tenant: string): IProvider<T> {
        tenant = tenant || context.user.tenant;
        let poolKey = tenant;
        let provider = this.getFromPool(poolKey);
        if (!provider) {
            provider = new MemoryProvider(this.dataFolder);
            let item: PoolItem = { provider };
            item.dispose = provider.initialize(tenant);
            if (item.dispose) {
                this.addToPool(context, poolKey, item);
            }
        }

        return <IProvider<any>>provider;
    }
}
