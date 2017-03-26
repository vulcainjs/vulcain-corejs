import { expect } from 'chai';
import { TestContext, DefaultActionHandler, DefaultQueryHandler, QueryHandler, Query, ActionHandler, Model, Property, RequestContext, IContainer } from '../../dist/index';
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
}

@QueryHandler({ scope: "?", schema: "TestModel", serviceName: "TestQueryService" })
class TestQueryHandler extends DefaultQueryHandler<TestModel> {
}

let context = new TestContext();

describe("Default action handler", function () {

    it("should register query handler as a service", () => {
        expect(context.rootContainer.get("TestQueryService")).to.be.not.null;
    });

    it("should create an entity", async function () {
        const actionHandler = context.createHandler<TestActionHandler>(TestActionHandler);
        let entity = { firstName: "elvis", lastName: "Presley" };
        await actionHandler.createAsync(entity);

        let query = context.createHandler<TestQueryHandler>(TestQueryHandler);
        entity = await query.getAsync("Presley");
        expect(entity).to.be.not.null;
    });

});

