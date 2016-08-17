import 'reflect-metadata';
import {Preloader} from '../preloader';

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
    static TestUser = "TestUser";
    static RequestContext = "RequestContext";
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

export function Injectable(lifeTime: LifeTime, name?:string)
{
    return function(target)
    {
        name = name || target.name;
        Preloader.registerPreload( target, ( container, domain ) =>
            {
                if( lifeTime )
                {
                    switch( lifeTime )
                    {
                        case LifeTime.Singleton:
                            container.injectSingleton( target, name );
                            break;
                        case LifeTime.Scoped:
                            container.injectScoped( target, name );
                            break;
                        case LifeTime.Transient:
                            container.injectTransient( target, name );
                            break;
                    }
                }
                else
                    container.injectTransient( target, name );
            }
        );
    }
}
