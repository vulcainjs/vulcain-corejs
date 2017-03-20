import { CommonRequestData } from '../pipeline/common';

export class MockManager {
    private mocks;

    constructor(mocks) {
        this.mocks = this.toJsonLowercase(mocks);
    }

    get disabled() {
        return this.mocks.disabled;
    }

    private toJsonLowercase(json) {
        if (!json)
            return null;

        let res = { disabled: json.disabled };
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

        if (a === b)
            return true;

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

    public async applyMockHttpAsync(url: string, verb: string) {
        let mock = this.mocks.http[url && url.toLowerCase()];
        mock = (mock && verb && mock[verb.toLowerCase()]) || mock;
        return (mock && mock.output) || mock || undefined;
    }

    public async applyMockServiceAsync(serviceName: string, serviceVersion: string, verb: string, data) {
        if (!serviceName)
            return;

        // Find on service name
        let mockService = this.mocks.services[serviceName.toLowerCase()];
        // And optionaly on service version
        mockService = (mockService && mockService[serviceVersion]) || mockService;
        if (!mockService) {
            return;
        }

        // Verb is optional
        let mock = verb && mockService[verb.toLowerCase()];
        if (!mock) {
            return;
        }

        if (!Array.isArray(mock)) {
            return mock;
        }

        // Iterate over data input filter
        for (let item of mock) {
            let input = item.input; // Input filter
            if (!input) {
                continue;
            }
            let ok = true;
            if (this.deepCompare(data, input)) {
                return item.output; // result
            }
        }
        return;
    }
}