import { RequestContext } from "./requestContext";
import url = require('url');
import { IContainer } from "../di/resolvers";
import { Pipeline } from "./common";
import { VulcainLogger } from "../log/vulcainLogger";
import { DefaultServiceNames } from "../di/annotations";
import { ApplicationRequestError } from "./errors/applicationRequestError";
import { HttpResponse, VulcainResponse } from "./response";

export abstract class VulcainMiddleware {
    next: VulcainMiddleware;

    invoke(ctx: RequestContext): Promise<void> {
        if (this.next)
            return this.next.invoke(ctx);

        return Promise.resolve();
    }
}

export interface HttpRequest {
    url: url.Url;
    headers: { [header: string]: string | string[] };
    body: any;
    verb: string;
}

export class VulcainPipeline {
    private first: VulcainMiddleware;
    private last: VulcainMiddleware;

    constructor(middlewares?: VulcainMiddleware[]) {
        if (middlewares) {
            middlewares.forEach(m => this.use(m));
        }
    }

    use(middleware: VulcainMiddleware) {
        if (!this.first) {
            this.first = this.last = middleware;
        }
        else {
            this.last.next = middleware;
            this.last = middleware;
        }
        return this;
    }

    async process(container: IContainer, request: HttpRequest) {
        let ctx = new RequestContext(container,
            Pipeline.HttpRequest,
            request
        );

        try {
            await this.first.invoke(ctx);
            let response = VulcainResponse.create(ctx);
        }
        finally {
            ctx.dispose();
        }
        return ctx.response;
    }
}