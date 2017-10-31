import { System } from '../../globals/system';
import { RequestContext, VulcainHeaderNames } from "../../pipeline/requestContext";

export interface ITenantPolicy {
    resolveTenant(ctx: RequestContext);
}

/**
 * Default policy
 *
 * @export
 * @class DefaultPolicy
 */
export class DefaultTenantPolicy {

    protected resolveFromHeader(ctx: RequestContext): string {
        let tenant = <string>ctx.request.headers[VulcainHeaderNames.X_VULCAIN_TENANT];
        if (!tenant)
            return;

        if (tenant === "?") {
            // from load-balancer so resolve from hostname
            // Get the first sub-domain
            let pos = ctx.hostName.indexOf('.');
            tenant = pos > 0 ? ctx.hostName.substr(0, pos) : ctx.hostName;
            // Remove port
            pos = tenant.indexOf(':');
            if (pos > 0) {
                tenant = tenant.substr(0, pos);
            }
            return tenant;
        }

        if (!tenant.startsWith("pattern:")) {
            return tenant;
        }

        let pattern = tenant.substr("pattern:".length);
        try {
            const regex = new RegExp(pattern.trim());
            const groups = regex.exec(ctx.hostName);
            if (groups && groups.length > 0) {
                return groups[1];
            }
        }
        catch (e) {
            ctx.logError(e, ()=> "TENANT pattern cannot be resolved " + pattern);
        }
    }

    resolveTenant(ctx: RequestContext): string {
        let tenant: string;
        // 1 - tenant in url (test only)
        tenant = (System.isTestEnvironnment && ctx.requestData.params.$tenant);
        if (tenant) {
            return tenant;
        }

        // 2 - Header
        tenant = this.resolveFromHeader(ctx);
        if (tenant) {
            return tenant;
        }

        // 3 - default
        return System.defaultTenant;
    }
}