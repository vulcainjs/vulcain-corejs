export class Preloader {
    private static _preloads: Array<Function> = [];

    static registerPreload(fn: Function, callback: (container, domain) => void) {
        let key = fn.name;
        Preloader._preloads.push(callback);
    }

    static runPreloads(container, domain) {
        if (Preloader._preloads) {
            for (const callback of Preloader._preloads) {
                callback(container, domain);
            }
            Preloader._preloads = null;
        }
    }
}