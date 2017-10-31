import { IConfigurationSource } from "../abstractions";
import * as fs from 'fs';
const NONE = "$$__none__$$";

export class EnvironmentVariableSource implements IConfigurationSource {

    get(name: string):any {
        // As is
        let env = process.env[name];
        if (env) {
            if (env === NONE)
                return undefined;
            return env;
        }

        // Replace dot
        env = process.env[name.replace(/\./g, '_')];
        if (env)
            return env;

        // Replace dot with uppercases
        env = process.env[name.toUpperCase().replace(/\./g, '_')];
        if (env)
            return env;

        // Transform camel case to upper case
        // ex: myProperty --> MY_PROPERTY
        const regex = /([A-Z])|(\.)/g;
        const subst = `_\$1`;
        let res = name.replace(regex, subst);
        env = process.env[res.toUpperCase()];

        // Otherwise as a docker secret
        if (env === undefined) {
            try {
                // Using sync method here is assumed
                env = fs.readFileSync('/run/secrets/' + name, { encoding: 'utf8', flag: 'r' });
            }
            catch (e) {
                // ignore error
            }
        }
        if (env === undefined) {
            // Set cache to avoid many file reads
            process.env[name] = NONE;
        }
        return env;
    }
}