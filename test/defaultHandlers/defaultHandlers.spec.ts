import { expect } from 'chai';
import {TestContainer, DefaultActionHandler, DefaultQueryHandler, QueryHandler, Query, ActionHandler, Model, Property, RequestContext, IContainer} from '../../dist/index';

@Model("TestModel")
class TestModel {
    @Property({type:"string", required: true})
    firstName: string;
    @Property({type:"string", required: true, isKey:true})
    lastName: string;
    @Property({type:"number"})
    Date: number;
}

@ActionHandler({schema: TestModel, scope:"?"})
class TestActionHandler extends DefaultActionHandler {
    constructor(container: IContainer) {
        super(container);
        this.requestContext = RequestContext.createMock(container);
    }
}

@QueryHandler({scope:"?", schema:TestModel, serviceName:"TestQueryService"})
class TestQueryHandler extends DefaultQueryHandler {
    constructor(container: IContainer) {
        super(container);
        this.requestContext = RequestContext.createMock(container);
    }
}

let container = new TestContainer("Test");

beforeEach(async function () {
});

describe("Default action handler", function () {

    it("should register query handler as a service", () => {
        expect(container.get("TestQueryService")).to.be.not.null;
    });

    it("should create an entity", async function (done) {

        try {
            let actionHandler = new TestActionHandler(container);
            let entity = { firstName: "elvis", lastName: "Presley" };
            await actionHandler.createAsync(entity);
            let query:any = container.get("TestQueryService");
            entity = await query.getAsync("presley");
            expect(entity).to.be.not.null;
            done();
        }
        catch (e) {
            console.log(e);
        }
    });

});


