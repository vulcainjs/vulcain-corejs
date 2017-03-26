import { expect } from 'chai';
import { Model, Property, Reference, Validator } from '../../dist/schemas/annotations';
import { Domain } from '../../dist/schemas/schema';
import { TestCommand } from './../command/commands';
import { TestContext } from '../../dist/di/testContext';


@Model()
class SimpleModel {
    @Property({ type: "string", required: true })
    text: string;
    @Property({ type: "uid" })
    uuid: string;
}

@Model()
class AggregateModel {
    @Reference({ item: "SimpleModel", cardinality: "one" })
    simple: SimpleModel;
}

let context = new TestContext();

describe("Bind data", function () {

    it("should create uid", () => {

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("AggregateModel");

        let data = { simple: { test: "test" } };
        let model = schema.bind(data);
        expect(model.simple.uuid).to.be.not.null;
    });

});