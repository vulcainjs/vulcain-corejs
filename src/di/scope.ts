export class Scope {
    private cache = new Map<string, any>();

    constructor(private parent?: Scope) { }

    getInstance(name: string) {
        if (!name)
            throw new Error("name argument must not be null");
        let component = this.cache.get(name);
        return component || this.parent && this.parent.getInstance(name);
    }

    set(name: string, component) {
        if (!name)
            throw new Error("name argument must not be null");
        this.cache.set(name, component);
    }

    dispose() {
        this.cache.forEach(v => v.dispose && v.dispose());
        this.cache.clear();
        this.parent = null;
    }
}
