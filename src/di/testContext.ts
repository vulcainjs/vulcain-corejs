
import { IContainer } from "./resolvers";
import { RequestContext, UserContext, Pipeline } from '../servers/requestContext';
import { Container } from './containers';
import { System } from '../configurations/globals/system';
import { ConfigurationManager } from '../configurations/configurationSources/configurationManager';
import { Domain } from '../schemas/schema';
import { DefaultServiceNames } from './annotations';
import { Preloader } from '../preloader';

export class TestContext {
    private _container: IContainer;
    private user: UserContext;


    constructor(...components) {
        this._container = new Container();
        let domain = new Domain(System.domainName, this._container);
        this._container.injectInstance(domain, DefaultServiceNames.Domain);
        Preloader.instance.runPreloads(this._container, domain);
    }

    setUser(user: UserContext) {
        this.user = user;
        return this;
    }

    createRequestContext() {
        let ctx = new RequestContext(this._container, Pipeline.Test);
        ctx.user = this.user || RequestContext.TestUser;
        ctx.user.tenant = ctx.tenant = System.defaultTenant;
        return ctx;
    }

    /**
     * Create a test scope
     * @param handler - Handler class
     **/
    createRequest<T extends any>(handler: Function, callback: (handler: T, ctx?: RequestContext) => Promise<void>) {
        let ctx = this.createRequestContext();
        let scopedContainer = new Container(this._container, ctx);
        let h = new (<(container: IContainer) => void>handler)(scopedContainer);
        h.requestContext = ctx;
        callback(h, ctx).then(() => ctx.dispose, () => ctx.dispose());
    }
}
