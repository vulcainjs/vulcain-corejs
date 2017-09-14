import { IConfigurationSource, IRemoteConfigurationSource } from "../abstractions";
import { EnvironmentVariableSource } from "./EnvironmentVariableSource";

export class PrioritizedSourceValue implements IConfigurationSource {
    private chain: IConfigurationSource[];

    constructor( local?: IConfigurationSource[], remote?: IRemoteConfigurationSource[]) {
        this.chain = [];
        if (remote)
            this.chain = this.chain.concat(remote);
        this.chain.push(new EnvironmentVariableSource());
        if (local)
            this.chain = this.chain.concat(local);
    }

    get(name: string) {
        for (let pv of this.chain) {
            let val = pv.get(name);
            if (val !== undefined) return val;
        }
        return undefined;
    }
}