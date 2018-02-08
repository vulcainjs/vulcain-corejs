import { expect } from "chai";
import { Model } from '../../src/schemas/builder/annotations.model';
import { Property } from '../../src/schemas/builder/annotations.property';
import { Validator, SchemaTypeDefinition } from '../../src/schemas/builder/annotations';
import { ISchemaTypeDefinition} from '../../src/schemas/schemaType'
import { Domain } from "../../src/schemas/domain";
import 'mocha';
import { SchemaStandardTypes } from "../../src/schemas/standards/standards";
import { TestContext } from '../../src/pipeline/testContext';

@Model()
class BaseModel {
    @Property({ type: "string", required: true })
    @Validator("length", { min: 2 })
    baseText: string;
}

@Model({ extends: "BaseModel" })
class SimpleModel extends BaseModel {
    @Property({ type: 'string', required: true })
    text: string;
    @Property({ type: 'number' })
    number: number;
}

@Model()
class ReferenceModel {
    @Property({ type: "SimpleModel", cardinality: "one", required: true })
    simple: SimpleModel;
    @Property({ type: "SimpleModel", cardinality: "many" })
    multiples: Array<SimpleModel>;
}


@Model()
class EmailModel {
    @Property({ type: SchemaStandardTypes.email })
    email: string;
}

@Model()
class UrlModel {
    @Property({ type: "url" })
    url: string;
}

@Model()
class AlphanumericModel {
    @Property({ type: "alphanumeric" })
    value: string;
}

@Model()
class DateIsoModel {
    @Property({ type: "date-iso8601" })
    date: string;
}

@SchemaTypeDefinition()
export class ArrayOfEnum implements ISchemaTypeDefinition {
    // Overrided properties
    $values: any[];

    // Type properties
    messages: string[];

    // Initialize properties
    constructor() {
        this.messages = [
            "Invalid value '{$value}' for '{$propertyName}', all values must be one of [{$values}].",
            "Invalid value '{$value}' for '{$propertyName}', value must be an array."
        ];
    }

    validate(val) {
        if (!this.$values) return "You must define array item enumeration values with the 'values' property.";
        if (!Array.isArray(val)) return this.messages[1];
        let error = false;
        for(let e of val) {
            if (this.$values.indexOf(val) === -1) {
                error = true;
                break;
            }
        }
        if (error) return this.messages[0];
    }

    // bind(val: any): any {}
}

@Model()
class ArrayOfModel {
    @Property({ type: "ArrayOfEnum", itemsType: "string", values: ["a", "b"] })
    enums: string[];
}

let context = new TestContext();

describe("Validate data", function () {

    it("should validate base class", async () => {
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");

        let model: SimpleModel = { text: "text", number: 1, baseText: "" };
        let errors = await schema.validate(null, model);
        expect(errors.baseText);
    });

    it("should validate call validator", async () => {
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");

        let model: SimpleModel = { text: "text", number: 1, baseText: "a" };
        let errors = await schema.validate(null, model);
        expect(errors.baseText);
    });

    it("should validate malformed number", async () => {
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");

        let model = schema.coerce({ text: "text", number: "1w1", baseText: "text" });
        let errors = await schema.validate(null, model);
        expect(errors.number);
    });

    it("should validate valid values", async () => {
        let model: SimpleModel = { text: "text", number: 1, baseText: "text" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("SimpleModel");
        let errors = await schema.validate(null, model);
        expect(Object.keys(errors).length).equals(0);
    });

    it("should validate values in reference", async () => {
        let model: any = { text: "text", number: "1M", baseText: "text" };
        let refs = { simple: model };

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ReferenceModel");
        let errors = await schema.validate(null, refs);

        expect(Object.keys(errors).length).equals(1);
    });

    it("should validate invalid multiple references", async () => {
        let model: any = { text: "text", number: "1M", baseText: "text" };
        let refs = { simple: model, multiples: model };

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ReferenceModel");
        let errors = await schema.validate(null, refs);

        expect(Object.keys(errors).length).equals(2);
    });

    it("should validate values in multiple references", async () => {
        let model: any = { text: "text", number: "1M", baseText: "text" };
        let refs = { simple: model, multiples: [model, model] };

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ReferenceModel");
        let errors = await schema.validate(null, refs);

        expect(Object.keys(errors).length).equals(1); // TODO really expected ?
    });

    it("should validate required reference", async () => {
        let refs = {};

        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ReferenceModel");
        let errors = await schema.validate(null, refs);

        expect(Object.keys(errors).length).equals(1);
    });

    // ---------------
    // email
    it('should validate email value', async () => {

        let model: EmailModel = { email: "first.name@email.com" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("EmailModel");
        let errors = await schema.validate(null, model);

        expect(!errors.email);
    });
    it('should validate malformed email value', async () => {

        let model: EmailModel = { email: "first.name@email" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("EmailModel");
        let errors = await schema.validate(null, model);

        expect(errors.email);
    });


    // ---------------
    // url
    it('should validate url value', async () => {

        let model: UrlModel = { url: "https://myWebsite.com/#ancre/1" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("UrlModel");
        let errors = await schema.validate(null, model);

        expect(Object.keys(errors).length).equals(0);
    });
    it('should validate malformed url value', async () => {

        let model: UrlModel = { url: "http://site.r" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("UrlModel");
        let errors = await schema.validate(null, model);

        expect(Object.keys(errors).length).equals(1);
    });

    // ---------------
    // Alphanumeric
    it('should validate alphanumeric value', async () => {

        let model: AlphanumericModel = { value: "abcde1345fghik6789" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("AlphanumericModel");
        let errors = await schema.validate(undefined, model);

        expect(Object.keys(errors).length).equals(0);
    });
    it('should validate malformed alphanumeric value', async () => {

        let model: AlphanumericModel = { value: "abc123!" };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("AlphanumericModel");
        let errors = await schema.validate(undefined, model);

        expect(Object.keys(errors).length).equals(1);
    });

    // ---------------
    // Date ISO86
    it('should validate date ISO8601', async () => {

        let model: DateIsoModel = { date: new Date().toISOString() };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("DateIsoModel");
        let errors = await schema.validate(undefined, model);

        expect(Object.keys(errors).length).equals(0);
    });


    it('should validate malformed date ISO8601', async () => {

        let model: DateIsoModel = { date: new Date().toDateString() };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("DateIsoModel");
        let errors = await schema.validate(undefined, model);

        expect(Object.keys(errors).length).equals(1);
    });

    // ---------------------
    // ArrayOf enum
    it('should validate array of enum', async () => {

        let model: ArrayOfModel = { enums: ["a", "bb"] };
        let domain = context.rootContainer.get<Domain>("Domain");
        let schema = domain.getSchema("ArrayOfModel");
        let errors = await schema.validate(undefined, model);

        expect(Object.keys(errors).length).equals(1);
    });
});
