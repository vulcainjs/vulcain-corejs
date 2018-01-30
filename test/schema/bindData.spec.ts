import { expect } from 'chai';
import { Model } from '../../src/schemas/builder/annotations.model';
import { Property } from '../../src/schemas/builder/annotations.property';
import { Domain } from '../../src/schemas/domain';
import { TestCommand } from './../command/commands';
import { TestContext } from '../../src/pipeline/testContext';


@Model()
class SimpleModel {
    @Property({ type: "string", required: true })
    text: string;
    @Property({ type: "uid" })
    uuid: string;
}

@Model()
class AggregateModel {
    @Property({ type: "SimpleModel", cardinality: "one" })
    simple: SimpleModel;
}

@Model()
class ModelWithDefaultValues {
    @Property({ type: 'string', required: true })
    value1 = "value1";
}

let context = new TestContext();

describe("Bind data", function () {

    it("should create uid", () => {

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("AggregateModel");

        let data = { simple: { test: "test" } };
        let model = schema.coerce(data);
        expect(model.simple.uuid).to.be.not.null;
    });

    it("should initialize default values", () => {

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ModelWithDefaultValues");

        let data = { };
        let model = schema.coerce(data);
        expect(model.value1).to.be.eq('value1');
    });


    it("should ignore not bounded property", () => {

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ModelWithDefaultValues");

        let data = { value2: "value2" };
        let model = schema.coerce(data);
        expect(model.value2).to.be.not.null;
    });
});