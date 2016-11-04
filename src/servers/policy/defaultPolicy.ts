import { System } from '../../configurations/globals/system';
import { RequestContext } from '../requestContext';

export interface IPolicy {
    /**
     * get user scopes
     *
     * @returns {Array<string>}
     *
     * @memberOf IPolicy
     */
    scopes(requestContext: RequestContext): Array<string>;
    /**
     * Check if the current user scopes are valid with a specific scope
     *
     * @param {string} handlerScope Scope to check
     * @returns {boolean}
     *
     * @memberOf IPolicy
     */
    hasScope(requestContext: RequestContext, handlerScope: string): boolean;
    isAdmin(requestContext: RequestContext): boolean;
}

/**
 * Default policy
 *
 * @export
 * @class DefaultPolicy
 */
export class DefaultPolicy {

    /**
     * Get user scopes
     *
     * @readonly
     * @type {Array<string>}
     */
    scopes(requestContext: RequestContext): Array<string> {
        return (requestContext.user && requestContext.user.scopes) || [];
    }

    /**
     * Check if the current user has a specific scope
     *
     * Rules:
     *   scope      userScope   Result
     *   null/?/*                 true
     *                  null      false
     *                   *        true
     *     x             x        true
     *     x-yz         x-*       true
     *
     * @param {string} scope
     * @returns {number}
     */
    hasScope(requestContext: RequestContext, handlerScope: string): boolean {
        if (requestContext.user && requestContext.user.tenant && requestContext.user.tenant !== requestContext.tenant) {
            return false;
        }
        if (!handlerScope || handlerScope === "?") {
            return true;
        }
        if (!requestContext.user) {
            return false;
        }
        if (handlerScope === "*") {
            return true;
        }

        const handlerScopes = handlerScope.split(',').map(s => s.trim());
        const userScopes = this.scopes(requestContext);

        if (!userScopes || userScopes.length === 0) {
            return false;
        }
        if (userScopes[0] === "*") {
            return true;
        }

        for (let userScope of userScopes) {
            let parts = userScope.split(':');
            if (parts.length < 2) {
                return false; // malformed
            }

            if (parts[0] !== System.domainName) {
                continue;
            }
            for (let sc of handlerScopes) {
                if (userScope === sc) {
                    return true;
                }
                // admin:* means all scope beginning by admin:
                if (userScope.endsWith("*") && sc.startsWith(userScope.substr(0, userScope.length - 1))) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if the current user is an admin
     *
     * @returns {boolean}
     */
    isAdmin(requestContext: RequestContext): boolean {
        let scopes = this.scopes(requestContext);
        return scopes && scopes.length > 0 && scopes[0] === "*";
    }
}