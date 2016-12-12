import { CommonRequestData } from '../../pipeline/common';

export class MockManager {

    constructor( private mocks) {
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
        let mock = this.mocks.http[url];
        mock = mock && mock[verb];
        return (mock && mock.output) || undefined;
    }

    public applyMockService(serviceName: string, serviceVersion: string, verb: string, data) {
        let mockService = this.mocks.services[serviceName];
        mockService = (mockService && mockService[serviceVersion]) || mockService;
        if (!mockService) {
            return;
        }

        let mock = mockService[verb];
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
            if(this.deepCompare(data, input)) {
                return item.output;
            }
        }
        return;
    }
}