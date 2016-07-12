import {Schema} from '../schemas/schema'
import {Logger} from '@sovinty/vulcain-configurations';
import {Container} from '../di/containers';
import {IContainer} from '../di/resolvers';

class DefaultLogger {
    log(msg: string | Error) {
        console.log((msg && (<Error>msg).message) || msg)
    }
    info(msg: string | Error) {
        console.log((msg && (<Error>msg).message) || msg)
    }
}

const defaultLogger = new DefaultLogger();

export class RequestContext {
    public user: any;
    public cache: Map<string, any>;
    public logger: Logger;
    public container: IContainer;

    constructor(container: IContainer) {
        this.cache = new Map<string, any>();
        this.logger = defaultLogger;
        this.container = new Container(container);
        this.container.injectInstance(this, "RequestContext");
    }

    dispose() {
        this.container.dispose();
    }

    static createMock(container?: IContainer, user?:any, req?) {
        let ctx = new RequestContext(container || new Container());
        ctx.user = user || {id:"test", scopes:["*"], name:"test", password:"", displayName:"test", email:"test", data:{}, disabled:false};
        return ctx;
    }

    get scopes(): Array<string> {
        return this.user && this.user.scopes
    }

    hasScope(scope: string): number {
        if (!scope || scope === "?") return 0;
        if (!this.user) return 401;
        if (scope === "*") return 0;

        if (!this.user.scopes || this.user.scopes.length == 0) return 403;
        if (this.user.scopes[0] === "*") return 0;

        let scopes = scope.split(',').map(s => s.trim());
        for (let userScope of this.user.scopes) {
            for (let sc of scopes) {
                if (userScope === sc) return 0;
                // admin-* means all scope beginning by admin-
                if (userScope.endsWith("*") && sc.startsWith(userScope.substr(0, userScope.length - 1)))
                    return 0;
            }
        }

        return 403;
    }

    isAdmin(): boolean {
        return this.scopes && this.scopes.length > 0 && this.scopes[0] === "*";
    }

    /*getCommand(name: string): ICommand {
        return CommandFactory.get(name, this);
    }*/
}
