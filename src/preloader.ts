import { IContainer } from './di/resolvers';

interface Item {
    callback: (container, domain) => void;
}

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

    registerModel(callback: (container, domain) => void) {
        this.register(Models, callback);
    }

    registerService(callback: (container, domain) => void) {
        this.register(Services, callback);
    }

    registerHandler(callback: (container, domain) => void) {
        this.register(Handlers, callback);
    }

    private register(key: string, callback) {
        let list = this._preloads[key];
        if (!list) {
            this._preloads[key] = list = [];
        }
        list.push({ callback: callback });
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
            this.run(Models, container, domain);
            this.run(Services, container, domain);
            this.run(Handlers, container, domain);
            this._preloads = {};
        }
    }
}