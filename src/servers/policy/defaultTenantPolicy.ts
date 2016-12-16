import { System } from '../../configurations/globals/system';
import { RequestContext } from '../requestContext';
import { IHttpAdapterRequest, VulcainHeaderNames } from '../abstractAdapter';

export interface ITenantPolicy {
    resolveTenant(ctx: RequestContext, req: IHttpAdapterRequest);
}

/**
 * Default policy
 *
 * @export
 * @class DefaultPolicy
 */
export class DefaultTenantPolicy {

    protected resolveFromHeader(ctx: RequestContext, req: IHttpAdapterRequest): string {
        let tenant = req.headers[VulcainHeaderNames.X_VULCAIN_TENANT];
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

        let parts = tenant.split(':');
        if (parts.length !== 2 || parts[0] !== "pattern") {
            return tenant;
        }

        let patterns = parts[1].split(',');
        for (let pattern of patterns) {
            try {
                const regex = new RegExp(pattern.trim());
                const groups = regex.exec(ctx.hostName);
                if (groups && groups.length > 0) {
                    return groups[1];
                }
            }
            catch (e) {
                ctx.logError(e, "TENANT pattern cannot be resolved " + pattern);
            }
        }
    }

    resolveTenant(ctx: RequestContext, req: IHttpAdapterRequest): string {
        let tenant: string;
        // 1 - tenant in url (test only)
        tenant = (System.isTestEnvironnment && req.query.$tenant);
        if (tenant) {
            return tenant;
        }

        // 2 - Header
        tenant = this.resolveFromHeader( ctx, req);
        if (tenant) {
            return tenant;
        }

        // 3 - Environnement variable
        if (System.defaultTenant) {
            return System.defaultTenant;
        }

        // 4 - test mode
        if (System.isTestEnvironnment) {
            return RequestContext.TestTenant;
        }
        else {
            // 5 - default
            return "vulcain";
        }
    }
}