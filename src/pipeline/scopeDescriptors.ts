import { ActionDescription } from './serviceDescriptions';
import { System } from '../configurations/globals/system';
import { Injectable, LifeTime, DefaultServiceNames } from '../di/annotations';

export class ScopeDescription {
    name: string;
    description: string;
    domain: string;
}

@Injectable(LifeTime.Singleton, DefaultServiceNames.ScopesDescriptor)
export class ScopesDescriptor {
    private scopes = new Array<ScopeDescription>();

    getScopes() {
        return this.scopes;
    }

    defineScope(name: string, description: string) {
        this.scopes.push({ name: System.domainName + ":" + name, description, domain: System.domainName });
    }
}