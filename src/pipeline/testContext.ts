import { System } from '../globals/system';
import { ConfigurationManager } from '../configurations/configurationManager';
import { Domain } from '../schemas/schema';
import { Preloader } from '../preloader';
import { ConsoleMetrics } from "../metrics/consoleMetrics";
import { IContainer } from "../di/resolvers";
import { UserContext } from "../security/securityManager";
import { Container } from "../di/containers";
import { RequestContext } from "./requestContext";
import { Pipeline } from "./common";
import { AbstractHandler } from "./handlers/abstractHandlers";
import { DefaultServiceNames } from '../di/annotations';

export class TestContext extends RequestContext {
    get rootContainer() {
        return this.container;
    }

    constructor(...components: Function[]) {
        super(new Container(), Pipeline.Test);
        let domain = new Domain(System.domainName, this.container);
        this.container.injectInstance(domain, DefaultServiceNames.Domain);
        this.container.injectInstance(new ConsoleMetrics(), DefaultServiceNames.Metrics);
        Preloader.instance.runPreloads(this.container, domain);
    }

    setUser(user: UserContext) {
        this.setSecurityManager(user);
        return this;
    }

    getService<T>(name: string) {
        return this.requestContext.container.get<T>(name);
    }

    get requestContext() {
        let ctx = new RequestContext(this.container, Pipeline.Test);
        ctx.setSecurityManager("test");
        return ctx;
    }

    createHandler<T extends AbstractHandler>(handler: Function) {
        let ctx = this.requestContext;
        let scopedContainer = new Container(this.container, ctx);
        let h = new (<(container: IContainer) => void>handler)(scopedContainer);
        h.requestContext = ctx;
        return h;
    }
}