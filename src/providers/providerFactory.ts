import { Injectable, LifeTime, Inject } from '../di/annotations';
import { DefaultServiceNames } from '../di/annotations';
import { Schema } from '../schemas/schema';
import { IProvider } from './provider';
import { IContainer } from '../di/resolvers';
import { System } from '../globals/system';
import { IRequestContext } from "../pipeline/common";

interface PoolItem {
    provider?: IProvider<any>;
    count?: number;
    dispose?: () => void;
}

class ContextualProvider {
    constructor(public ctx: IRequestContext, provider) {
        (<any>this).__proto__ = Object.getPrototypeOf(provider)
        Object.assign(this, provider);
    }
}

export class ProviderFactory {
    private pool = new Map<string, PoolItem>();

    constructor(public maxPoolSize = 20) {
    }

    private addToPool(context: IRequestContext, key: string, item: PoolItem) {
        System.log.info(context, () => `Adding a new provider pool item : ${key}`);
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
            System.log.info(context, () => `Ejecting ${keyToRemove} from provider pool item.`);
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

    getProvider(context: IRequestContext, tenant?: string, providerName: string = DefaultServiceNames.Provider) {
        tenant = tenant || context.user.tenant;
        let poolKey = providerName + "!" + tenant;
        let provider = this.getFromPool(poolKey);
        if (!provider) {
            provider = context.container.get<IProvider<any>>(providerName, false, LifeTime.Transient);
            let item: PoolItem = { provider };
            item.dispose = provider.setTenant(tenant);
            if (item.dispose) {
                this.addToPool(context, poolKey, item);
            }
        }

        return <IProvider<any>><any>new ContextualProvider(context, provider);
    }
}
