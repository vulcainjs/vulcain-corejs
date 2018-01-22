import { expect } from 'chai';
import { DefaultActionHandler,  ActionHandler, Action, DefaultServiceNames } from '../../dist/index';
import { TestContext } from '../../dist/pipeline/testContext';
import { ServiceDescriptors } from '../../dist/pipeline/handlers/serviceDescriptions';

@ActionHandler({ scope: "?" })
class TestActionHandler extends DefaultActionHandler {
    @Action({action: "new", description: "rename create action"})
    create(entity) {
        return super.create(entity);
    }
}


let context = new TestContext();

describe("Default action handler", function () {

    it("should override existing action", async function () {

        let descriptor = context.getService<ServiceDescriptors>(DefaultServiceNames.ServiceDescriptors);
        expect(descriptor.getHandlerInfo(context.container, null, "new")).to.be.not.null;
        expect(descriptor.getHandlerInfo(context.container, null, "create", true)).to.be.null;
    });

});

