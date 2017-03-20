import { expect } from 'chai';
import { TestContainer, DefaultActionHandler, DefaultQueryHandler, QueryHandler, Query, ActionHandler, Model, Property, RequestContext, IContainer } from '../../dist/index';
import { DefaultServiceNames } from '../../src/di/annotations';

@Model()
class TestModel {
    @Property({ type: "string", required: true })
    firstName: string;
    @Property({ type: "string", required: true, isKey: true })
    lastName: string;
    @Property({ type: "number" })
    Date: number;
}

@ActionHandler({ schema: "TestModel", scope: "?" })
class TestActionHandler extends DefaultActionHandler {
    constructor(container: IContainer) {
        super(container);
        this.requestContext = RequestContext.createMock(container);
    }
}

@QueryHandler({ scope: "?", schema: "TestModel", serviceName: "TestQueryService" })
class TestQueryHandler extends DefaultQueryHandler<TestModel> {
    constructor(container: IContainer) {
        super(container);
        this.requestContext = RequestContext.createMock(container);
    }
}

let container = new TestContainer("Test");

describe("Default action handler", function () {

    it("should register query handler as a service", () => {
        expect(container.get("TestQueryService")).to.be.not.null;
    });

    it("should create an entity", async function () {
        let actionHandler = new TestActionHandler(container);
        let entity = { firstName: "elvis", lastName: "Presley" };
        await actionHandler.createAsync(entity);
        let query = new TestQueryHandler(container);
        entity = await query.getAsync("Presley");
        expect(entity).to.be.not.null;
    });

});

