import { CommonRequestData } from '../../pipeline/common';

export class MockManager {
    private mocks;

    constructor(mocks) {
        this.mocks = this.toJsonLowercase(mocks);
    }

    private toJsonLowercase(json) {
        if (!json)
            return null;

        let res = {};
        for (let key of Object.keys(json)) {
            let val = json[key];
            key = key.toLowerCase();
            if (Array.isArray(val)) {
                res[key] = [];
                for (let item of val) {
                    res[key].push(this.toJsonLowercase(item));
                }
            }
            else if (typeof val === "object") {
                res[key] = this.toJsonLowercase(val);
            }
            else {
                res[key] = val;
            }
        }
        return res;
    }

    private deepCompare(a, b) {
        if (!b) {
            return true;
        }
        if (!a) {
            return false;
        }

        for (let p of Object.keys(b)) {
            let val = b[p];
            if (typeof val === "object") {
                if (!this.deepCompare(a[p], val)) {
                    return false;
                }
                continue;
            }
            if (Array.isArray(val)) {
                let val2 = a[p];
                if (val.length !== val2.length) {
                    return false;
                }
                for (let i; i < val.length; i++) {
                    if (!this.deepCompare(val2[i], val[i])) {
                        return false;
                    }
                }
                continue;
            }
            if (a[p] !== val) {
                return false;
            }
        }
        return true;
    }

    public applyMockHttp(url: string, verb: string) {
        let mock = this.mocks.http[url && url.toLowerCase()];
        mock = mock && verb && mock[verb.toLowerCase()];
        return (mock && mock.output) || undefined;
    }

    public applyMockService(serviceName: string, serviceVersion: string, verb: string, data) {
        if (!serviceName)
            return;

        let mockService = this.mocks.services[serviceName.toLowerCase()];
        mockService = (mockService && mockService[serviceVersion]) || mockService;
        if (!mockService) {
            return;
        }

        let mock = verb && mockService[verb.toLowerCase()];
        if (!mock) {
            return;
        }

        if (!Array.isArray(mock)) {
            return mock;
        }

        for (let item of mock) {
            let input = item.input;
            if (!input) {
                continue;
            }
            let ok = true;
            if (this.deepCompare(data, input)) {
                return item.output;
            }
        }
        return;
    }
}