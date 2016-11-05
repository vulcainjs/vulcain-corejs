import { Injectable, LifeTime } from '../di/annotations';
import { DefaultServiceNames } from '../di/annotations';
import { Schema } from '../schemas/schema';
import { IProvider } from './provider';
import { IContainer } from '../di/resolvers';

interface PoolItem {
    state: any;
    count: number;
}

@Injectable(LifeTime.Singleton, DefaultServiceNames.ProviderFactory)
export class ProviderFactory {
    private pool = new Map<string, PoolItem>();

    constructor(public maxPoolSize = 20) {
    }

    private addToPool(key: string, state) {
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
            item.state.dispose && item.state.dispose();
            this.pool.delete(keyToRemove);
        }
        this.pool.set(key, { count: 1, state });
    }

    private getFromPool(key: string) {
        let item = this.pool.get(key);
        if (item) {
            item.count++;
            return item.state;
        }
    }

    async getProviderAsync(container: IContainer, tenant: string, schema: Schema) {
        let key = tenant + "!" + schema.name;

        let provider = container.get<IProvider<any>>(DefaultServiceNames.Provider, false, LifeTime.Transient | LifeTime.Scoped);
        let state = this.getFromPool(key);
        if (state) {
            (<any>provider).state = state;
        }
        else {
            state = await provider.initializeWithSchemaAsync(tenant, schema);
            if (state) {
                this.addToPool(key, state);
            }
        }

        return provider;
    }
}