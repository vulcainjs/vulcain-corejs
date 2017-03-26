
import { IContainer } from "./resolvers";
import { RequestContext, UserContext, Pipeline } from '../servers/requestContext';
import { Container } from './containers';
import { System } from '../configurations/globals/system';
import { ConfigurationManager } from '../configurations/configurationSources/configurationManager';
import { Domain } from '../schemas/schema';
import { DefaultServiceNames } from './annotations';
import { Preloader } from '../preloader';
import { AbstractHandler } from '../pipeline/abstractHandlers';

export class TestContext {
    private _container: IContainer;
    private user: UserContext;

    get rootContainer() {
        return this._container;
    }

    constructor(...components: Function[]) {
        this._container = new Container();
        let domain = new Domain(System.domainName, this._container);
        this._container.injectInstance(domain, DefaultServiceNames.Domain);
        Preloader.instance.runPreloads(this._container, domain);
    }

    setUser(user: UserContext) {
        this.user = user;
        return this;
    }

    get requestContext() {
        let ctx = new RequestContext(this._container, Pipeline.Test);
        ctx.user = this.user || RequestContext.TestUser;
        ctx.user.tenant = ctx.tenant = System.defaultTenant;
        return ctx;
    }

    createHandler<T extends AbstractHandler>(handler: Function) {
        let ctx = this.requestContext;
        let scopedContainer = new Container(this._container, ctx);
        let h = new (<(container: IContainer) => void>handler)(scopedContainer);
        h.requestContext = ctx;
        return h;
    }
}
