import { Inject, DefaultServiceNames } from '../../di/annotations';
import { ITokenService } from '../../defaults/services';
import { System } from '../../configurations/globals/system';
import { RequestContext, UserContext } from '../requestContext';
import * as express from 'express';
import { VulcainLogger } from '../../configurations/log/vulcainLogger';

export abstract class AbstractExpressAuthentication {
    static readonly Anonymous: UserContext = { name: "_anonymous", scopes: [], tenant: null };

    private strategies = new Map<string, (ctx: RequestContext, token: string) => Promise<UserContext>>();

    addOrReplaceStrategy(name: string, verify: (ctx: RequestContext, token: string) => Promise<UserContext>) {
        this.strategies.set(name, verify);
    }

    /**
     * Initialize authentication process
     *
     * @param {UserContext} testUser User to use for testing when no authentication is provide
     * @param {boolean} ignoreInvalidBearer Do not reject invalid bearer token, just ignore it. Can be initialize with application.ignoreInvalidBearer property.
     * @returns
     *
     * @memberOf ExpressAuthentication
     */
    init() {

        return async (req, res: express.Response, next) => {
            let ctx: RequestContext = req.requestContext;
            if (!ctx) {
                res.status(400);
                res.send();
                return;
            }
            let authorization = req.headers['authorization'];
            // Perhaps in cookies
            if (!authorization)
                authorization = req.cookies && req.cookies.Authorization;

            if (!authorization) {
                next();
                return;
            }

            try {
                let parts = authorization.split(' ');
                if (parts.length < 2) {
                    throw new Error("Invalid authorization header : " + authorization);
                }

                let scheme = parts[0], token = parts[1];
                for (let [strategyName, verify] of this.strategies) {
                    if (!scheme || scheme.substr(0, strategyName.length).toLowerCase() !== strategyName)
                        continue;
                    if (!token) { throw new Error("Invalid authorization header."); }

                    let user = await verify(ctx, token);
                    if (user) {
                        ctx.user = user;
                        if (ctx.user.tenant) {
                            ctx.tenant = ctx.user.tenant;
                        }
                        else {
                            ctx.user.tenant = ctx.tenant;
                        }
                        // For context propagation
                        if (strategyName === "bearer")
                            ctx.bearer = token;
                        next();
                        return;
                    }
                    else if (strategyName !== "bearer") {
                        let logger = ctx.container.get<VulcainLogger>(DefaultServiceNames.Logger);
                        logger.logAction(ctx, 'ER');
                        res.status(401);
                        res.send();
                        return;
                    }
                    next();
                    return;
                }
            }
            catch (err) {
                ctx.logError(err, "Authentication error");
            }
            let logger = ctx.container.get<VulcainLogger>(DefaultServiceNames.Logger);
            logger.logAction(ctx, 'ER');

            res.status(401);
            res.send();
        };
    };
}
