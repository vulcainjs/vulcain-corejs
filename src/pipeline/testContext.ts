import { Service } from '../globals/system';
import { Domain } from '../schemas/domain';
import { Preloader } from '../preloader';
import { ConsoleMetrics } from "../instrumentations/metrics/consoleMetrics";
import { IContainer } from "../di/resolvers";
import { UserContext } from "../security/securityContext";
import { Container } from "../di/containers";
import { RequestContext } from "./requestContext";
import { Pipeline, IRequestContext } from "./common";
import { AbstractHandler } from "./handlers/abstractHandlers";
import { DefaultServiceNames } from '../di/annotations';

export class TestContext extends RequestContext {
    get rootContainer() {
        return this.container;
    }

    constructor() {
        super(new Container(), Pipeline.Test);
        let domain = new Domain(Service.domainName, this.container);
        this.container.injectInstance(domain, DefaultServiceNames.Domain);
        this.container.injectInstance(new ConsoleMetrics(), DefaultServiceNames.Metrics);
        Preloader.instance.runPreloads(this.container, domain);
    }

    setUser(user: UserContext) {
        this.setSecurityContext(user);
        return this;
    }

    getService<T>(name: string): T {
        return this.context.container.get<T>(name);
    }

    get context() {
        return TestContext.newContext(this.container);
    }

    static newContext(container: IContainer, data?: any): IRequestContext {
        let ctx = new RequestContext(container, Pipeline.Test, data);
        ctx.setSecurityContext("test");        
        ctx.normalize();
        return ctx;
    }

    createHandler<T extends AbstractHandler>(handler: Function): T {
        let ctx = <RequestContext>this.context;
        let scopedContainer = new Container(this.container, ctx);
        let h = new (<(container: IContainer) => void>handler)(scopedContainer);
        h.context = ctx;
        return h;
    }
}