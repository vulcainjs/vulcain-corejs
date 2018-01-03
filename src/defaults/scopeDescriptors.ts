
import { Injectable, DefaultServiceNames, LifeTime } from "../di/annotations";
import { Service } from "../globals/system";

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
        this.scopes.push({ name: Service.domainName + ":" + name, description, domain: Service.domainName });
    }
}
