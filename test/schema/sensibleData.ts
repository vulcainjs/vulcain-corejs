import { TestContainer } from './../../dist/di/containers';
import { expect } from 'chai';
import {Model, Property, Reference} from '../../dist/schemas/annotations';
import {Domain} from '../../dist/schemas/schema';

@Model()
class SimpleModel {
    @Property({type:"string"})
    normal: string;
    @Property({type:"string", sensible:true})
    password: string;
}

@Model()
class AggregateModel {
    @Reference({item:"SimpleModel", cardinality:"one"})
    simple: SimpleModel;
}

let container = new TestContainer("Test");

describe("Sensible data", function () {

    it("should encrypt sensible properties", () => {
        let model = { normal: "normal", password: "password" };
        let domain = container.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");
        schema.encrypt(model);
        expect(model.normal).equals("normal");
        expect(model.password).not.eq("password");
     });

    it("should encrypt embedded sensible properties", () => {
        let model = { simple: { normal: "normal", password: "password" } };
        let domain = container.get<Domain>("Domain");
        let schema = domain.getSchema("AggregateModel");
        schema.encrypt(model);
        expect(model.simple.normal).equals("normal");
        expect(model.simple.password).not.eq("password");
    });

    it("should decrypt sensible properties", () => {
        let model = { normal: "normal", password: "password" };
        let domain = container.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");
        schema.encrypt(model);
        schema.decrypt(model);
        expect(model.normal).equals("normal");
        expect(model.password).equals("password");
    });

    it("should remove sensible properties", () => {
        let model = { normal: "normal", password: "password" };
        let domain = container.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");
        domain.obfuscate(model, schema);
        expect(model.normal).equals("normal");
        expect(model.password).to.be.undefined;
     });
})