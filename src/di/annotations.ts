import 'reflect-metadata';

export class DefaultServiceNames
{
    static "Authentication" = "Authentication";
    static "Logger" = "Logger";
    static "Provider" = "Provider";
    static "EventBusAdapter" = "EventBusAdapter";
    static "ActionBusAdapter" = "ActionBusAdapter";
    static "Domain" = "Domain";
    static "Application" = "ApplicationFactory";
    static "ServerAdapter" = "ServerAdapter";
    static Container = "Container";
    static ProviderFactory = "ProviderFactory";
}

export enum LifeTime {
    Singleton=1,
    Transient=2,
    Scoped=4
}

export function Inject(name: string, optional?: boolean) {
    return function(target, key, i) {
        let injects = Reflect.getOwnMetadata(Symbol.for("di:injects"), target) || [];

        injects[i] = {name:name, optional:!!optional};
        Reflect.defineMetadata(Symbol.for("di:injects"), injects, target);
    }
}

export function Injectable(name:string, lifeTime: LifeTime)
{
    return function(target)
    {
        Reflect.defineMetadata(Symbol.for("di:export"), {name:name, lifeTime:lifeTime}, target);
    }
}
