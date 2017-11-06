import { RequestContext } from "../requestContext";
import { DefaultServiceNames } from "../../di/annotations";
import { VulcainMiddleware } from "../vulcainPipeline";
import { ITenantPolicy } from "../policies/defaultTenantPolicy";

export class AuthenticationMiddleware extends VulcainMiddleware {

    async invoke(ctx: RequestContext) {
        let tenantPolicy = ctx.container.get<ITenantPolicy>(DefaultServiceNames.TenantPolicy);
        ctx.setSecurityManager(tenantPolicy.resolveTenant(ctx));

        await ctx.user.process(ctx);

        return await super.invoke(ctx);
    }
}