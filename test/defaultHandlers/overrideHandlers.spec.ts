import { expect } from 'chai';
import { DefaultActionHandler, ActionHandler, Action, DefaultServiceNames } from '../../src/index';
import { TestContext } from '../../src/pipeline/testContext';
import { ServiceDescriptors } from '../../src/pipeline/handlers/descriptions/serviceDescriptions';
import { IdArguments } from '../../src/defaults/crudHandlers';

@ActionHandler({ scope: "?" })
class TestActionHandler extends DefaultActionHandler {
    @Action({name: "new", description: "rename create action"})
    create(entity) {
        return super.create(entity);
    }
}

let context:TestContext;
beforeEach(() => {
    context = new TestContext(); // Initialize context
});

describe("Default action handler", function () {
    it("should override existing action", async function () {
        let descriptor = context.getService<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
    // TODO    expect(descriptor.getHandlerInfo(context.container, null, "new")).to.be.not.null;
    //    expect(descriptor.getHandlerInfo(context.container, null, "create")).to.be.null;
    });
});

