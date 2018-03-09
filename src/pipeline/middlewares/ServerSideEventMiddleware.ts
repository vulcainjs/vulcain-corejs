import { RequestContext } from "../requestContext";
import { DefaultServiceNames } from "../../di/annotations";
import { VulcainMiddleware } from "../vulcainPipeline";
import { ITenantPolicy } from "../policies/defaultTenantPolicy";
import { IServerAdapter} from '../serverAdapter';

export class ServerSideEventMiddleware  {
    next: VulcainMiddleware;

    constructor(private adapter: IServerAdapter) {
    }

    invoke(ctx: RequestContext): Promise<void> {
        let endpoint = this.adapter.getRoute(e => e.kind === "SSE" && e.verb === ctx.request.verb && ctx.request.url.pathname.startsWith(e.path));
        if (endpoint) {
            ctx.logInfo(() => `SSE input   : ${ctx.requestData.vulcainVerb}, params: ${JSON.stringify(ctx.requestData.params)}`);
            ctx.logInfo(() => `SSE context : user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.user.tenant}`);
    
            ctx.keepConnected = true;
            endpoint.handler(ctx);
            return;
        }

        if (this.next)
            return this.next.invoke(ctx);

        return;
    }
}