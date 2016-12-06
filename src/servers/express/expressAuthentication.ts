import { Inject, DefaultServiceNames } from '../../di/annotations';
import { ITokenService } from '../../defaults/services';
import { AuthenticationStrategies } from './auth/authenticationStrategies';
import { System } from '../../configurations/globals/system';
import { RequestContext, UserContext } from '../requestContext';
import * as express from 'express';

export class ExpressAuthentication {
    private strategies: Array<{name: string, verify: (ctx: RequestContext, token: string) => Promise<UserContext>}> = [
        { name: 'bearer', verify: AuthenticationStrategies.bearerAuthentication }
    ];

    constructor( @Inject("ApiKeyService", true) apiKeys: ITokenService) {
        if (apiKeys) {
            // add apiKey as authentication strategies
            this.addStrategy('apikey',AuthenticationStrategies.apiKeyAuthentication);
        }
    }

    addStrategy(name: string, verify: (ctx: RequestContext, token: string) => Promise<UserContext>) {
        this.strategies.unshift({ name, verify });
    }

    init(testUser: UserContext) {
        return async (req, res: express.Response, next) => {
            let ctx: RequestContext = req.requestContext;
            let authorization = req.headers['authorization'];
            // Perhaps in cookies
            if (!authorization)
                authorization = req.cookies && req.cookies.Authorization;

            if (!authorization) {
                // Force test user only if there is no authorization
                if (testUser) {
                    ctx.user = testUser;
                    ctx.tenant = ctx.tenant || ctx.user.tenant;
                    System.log.info(ctx, `Request context - force test user=${ctx.user.name}, scopes=${ctx.user.scopes}, tenant=${ctx.tenant}`);
                    next();
                    return;
                }

                try {
                    let parts = authorization.split(' ');
                    if (parts.length < 2) {
                        throw new Error("Invalid authorization header : " + authorization);
                    }

                    let scheme = parts[0], token = parts[1];
                    for (let strategy of this.strategies) {
                        if (!scheme || scheme.substr(0, strategy.name.length).toLowerCase() !== strategy.name)
                            continue;
                        if (!token) { throw new Error("Invalid authorization header."); }

                        let user = await strategy.verify(ctx, token);
                        if (user) {
                            ctx.user = user;
                            if (ctx.user.tenant) {
                                ctx.tenant = ctx.user.tenant;
                            }
                            else {
                                ctx.user.tenant = ctx.tenant;
                            }
                            // For context propagation
                            if( strategy.name === "bearer")
                                ctx.bearer = token;
                            next();
                            return;
                        }
                    }
                }
                catch (err) {
                    ctx.logInfo(err.message);
                }

                res.statusCode = 401;
                res.end();
            };
        };
    }
}










