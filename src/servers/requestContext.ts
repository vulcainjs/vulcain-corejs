import {Schema} from '../schemas/schema'
import {Logger} from 'vulcain-configurationsjs';
import {Container} from '../di/containers';
import {IContainer} from '../di/resolvers';
import {CommandFactory} from '../commands/command/commandFactory';
import {ICommand} from '../commands/command/abstractCommand'

class DefaultLogger {
    log(msg: string | Error) {
        console.log((msg && (<Error>msg).message) || msg)
    }
    info(msg: string | Error) {
        console.log((msg && (<Error>msg).message) || msg)
    }
}

const defaultLogger = new DefaultLogger();

export enum Pipeline {
    inProcess,
    eventNotification,
    Http
}

export class RequestContext {
    public user: any;
    public cache: Map<string, any>;
    public logger: Logger;
    public container: IContainer;
    public requestHeaders: { [name: string]: string };
    public responseHeaders: Map<string,string>;
    public responseCode: number;
    public tenant: string;

    constructor(container: IContainer, public pipeline: Pipeline) {
        this.cache = new Map<string, any>();
        this.logger = defaultLogger;
        this.container = new Container(container);
        this.container.injectInstance(this, "RequestContext");
    }

    dispose() {
        this.container.dispose();
    }

    static createMock(container?: IContainer, user?:any, req?) {
        let ctx = new RequestContext(container || new Container(), Pipeline.inProcess);
        ctx.tenant = "_test_";
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

    getCommand(name: string, schema?:string) {
        return CommandFactory.get(name, this, schema);
    }
}
