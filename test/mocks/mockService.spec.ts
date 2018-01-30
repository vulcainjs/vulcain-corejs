import { expect } from "chai";
import { StubManager } from '../../src/stubs/stubManager';

let stubDefinitions = {
    services: {
        service1: {
            "customer.create": 1
        },
        service2: {
            "1.0": {
                "customer.create": 2
            },
            "2.0": {
                "customer.create": 22
            }
        },
        service3:
        {
            "customer.get":
            [
                {
                    input: {data: {id: "id3", filter: "filter1"}},
                    output: 333
                },
                {
                    input: {data: {id: "id3"}},
                    output: 3
                },
                {
                    input: {data: {id: "id33"}},
                    output: 33
                }
            ]
        }
    }
};

let manager = new StubManager();
describe('Stub service', function () {

    it('should do nothing if no match', async () => {

        manager.initialize(stubDefinitions);

        expect(await manager.applyServiceStub("service1", "1.0", "Customer.delete", {})).to.be.undefined;
        expect(await manager.applyServiceStub("service2", "1.0", "Customer.delete", {})).to.be.undefined;
        expect(await manager.applyServiceStub("service2", "3.0", "Customer.get", {})).to.be.undefined;
        expect(await manager.applyServiceStub("service3", "1.0", "Customer.delete", {})).to.be.undefined;
        expect(await manager.applyServiceStub("service3", "1.0", "Customer.get", { data: {id:"id0"} })).to.be.undefined;
    });

    it('should return value if match', async () => {

        manager.initialize(stubDefinitions);

        expect((await manager.applyServiceStub("service1", "3.0", "Customer.create", {})).content).to.be.equals(1);
        expect((await manager.applyServiceStub("service2", "2.0", "Customer.create", {})).content).to.be.equals(22);
        expect((await manager.applyServiceStub("service3", "2.0", "Customer.get", { data: {id:"id33"}  })).content).to.be.equals(33);
        expect((await manager.applyServiceStub("service3", "2.0", "Customer.get", { data: {id:"id3", filter:"filter1"}  })).content).to.be.equals(333);
        expect((await manager.applyServiceStub("service3", "2.0", "Customer.get", { data: {id:"id3"}  })).content).to.be.equals(3);
    });

});
