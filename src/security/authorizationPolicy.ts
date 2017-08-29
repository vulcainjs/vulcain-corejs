import { SecurityManager } from './securityManager';
import { System } from "../configurations/globals/system";

export interface IAuthorizationPolicy {
    /**
     * get user scopes
     *
     * @returns {Array<string>}
     *
     * @memberOf IPolicy
     */
    scopes(sec: SecurityManager): Array<string>;
    /**
     * Check if the current user scopes are valid with a specific scope
     *
     * @param {string} handlerScope Scope to check
     * @returns {boolean}
     *
     * @memberOf IPolicy
     */
    hasScope(sec: SecurityManager, handlerScope: string): boolean;
    isAdmin(sec: SecurityManager): boolean;
}

/**
 * Default policy
 *
 * @export
 * @class DefaultPolicy
 */
export class DefaultAuthorizationPolicy {

    /**
     * Get user scopes
     *
     * @readonly
     * @type {Array<string>}
     */
    scopes(sec: SecurityManager): Array<string> {
        return (sec && sec.scopes) || [];
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
    hasScope(sec: SecurityManager, handlerScope: string): boolean {
        if (!handlerScope || handlerScope === "?" || System.isDevelopment) {
            return true;
        }
        if (!sec || !sec.name) {
            return false;
        }
        if (handlerScope === "*") {
            return true;
        }

        const handlerScopes = handlerScope.split(',').map(s => s.trim());
        const userScopes = this.scopes(sec);

        if (!userScopes || userScopes.length === 0) {
            return false;
        }
        if (userScopes[0] === "*") {
            return true;
        }

        for (let userScope of userScopes) {
            let parts = userScope.split(':');
            if (parts.length < 2) {
                continue; // malformed
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
    isAdmin(sec: SecurityManager): boolean {
        let scopes = this.scopes(sec);
        return scopes && scopes.length > 0 && scopes[0] === "*";
    }
}