import { IContainer } from './di/resolvers';

interface Item {
    name: string;
    callback: (container, domain) => void;
}

const Types = "types";
const Models = "models";
const Services = "services";
const Handlers = "handlers";


export class Preloader {
    private static _instance: Preloader;

    static get instance() {
        if (!Preloader._instance) {
            Preloader._instance = new Preloader();
        }
        return Preloader._instance;
    }

    private _preloads: { [name: string]: Array<Item> } = {};

    registerType(fn: Function, callback: (container, domain) => void) {
        let key = fn.name;
        this.register(Types, key, callback);
    }

    registerModel(fn: Function, callback: (container, domain) => void) {
        let key = fn.name;
        this.register(Models, key, callback);
    }

    registerService(fn: Function, callback: (container, domain) => void) {
        let key = fn.name;
        this.register(Services, key, callback);
    }

    registerHandler(fn: Function, callback: (container, domain) => void) {
        let key = fn.name;
        this.register(Handlers, key, callback);
    }

    private register(key: string, name: string, callback) {
        let list = this._preloads[key];
        if (!list) {
            this._preloads[key] = list = [];
        }
        list.push({ name, callback: callback });
    }

    private run(key: string, container, domain) {
        let items = this._preloads[key];
        if (!items) return;
        for (const item of items) {
            item.callback(container, domain);
        }
    }

    runPreloads(container: IContainer, domain) {
        if (this._preloads) {
            this.run(Types, container, domain);
            this.run(Models, container, domain);
            this.run(Services, container, domain);
            this.run(Handlers, container, domain);
            this._preloads = {};
        }
    }
}