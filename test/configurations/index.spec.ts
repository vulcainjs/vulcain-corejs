import { expect } from 'chai';
import * as sinon from 'sinon';
import { DynamicConfiguration } from '../../dist/configurations/dynamicConfiguration';
import { MockConfigurationSource } from '../../dist/configurations/sources/memoryConfigurationSource';
import { DynamicProperty } from '../../src/configurations/properties/dynamicProperty';

describe('DynamicConfiguration', function () {

    beforeEach(function () {
        DynamicConfiguration.manager.reset(1);
    });

    it('should have default values', function () {

        expect(DynamicConfiguration.getProperty("test")).to.be.undefined;
        let p = DynamicConfiguration.asProperty("test", 10);
        expect(p.value).to.equal(10);
    });

    it('should create property', function () {

        let prop = DynamicConfiguration.asProperty("test", 10);
        expect(prop).not.to.be.null;
        expect(10).to.be.equal(prop.value);
        let p = DynamicConfiguration.getProperty("test");
        expect(10).to.equal(p.value);
        let prop2 = DynamicConfiguration.getProperty("test");
        expect(prop2).not.to.be.null;
        expect(prop.value).to.equal(prop2.value);
    });

    it('should thrown on duplicate property', function () {

        let prop = DynamicConfiguration.asProperty("test", 10);
        expect(() => {
            let prop2 = DynamicConfiguration.asProperty("test", 10);
        }
        ).to.throw();
    });

    it('should raise changed event', () => {

        let cx = 0;
        DynamicConfiguration.manager.reset();
        DynamicConfiguration.manager.propertyChanged
            .filter( p => p.name === "test")
            .subscribe((property) => {
                cx += property.value;
            });

        let prop = DynamicConfiguration.asProperty("test", 10);
        prop.set(15);
        let prop2 = DynamicConfiguration.asProperty("test2", 10);
        prop.set(20);

        expect(10 + 15 + 20).to.equal(cx);
        expect(20).to.equal(prop.value);
    });

    it('should support different types', function () {
        expect(10).to.equal(DynamicConfiguration.asProperty("test", 10).value);
        expect(2.0).to.equal(DynamicConfiguration.asProperty("test2", 2.0).value);
        expect("xxx").to.equal(DynamicConfiguration.asProperty("test3", "xxx").value);
        expect(true).to.equal(DynamicConfiguration.asProperty("test4", true).value);
        let v2 = [1, 2, 3];
        expect(v2).to.equal(DynamicConfiguration.asProperty("test6", v2).value);
    });

    it('should chain values', function () {

        let chained = DynamicConfiguration.asChainedProperty("test", 30, "test1");
        expect(30).to.equal(chained.value);

        let prop2 = DynamicConfiguration.asProperty("test1", 20);
        expect(20).to.equal(chained.value);

        prop2.set(25);
        expect(25).to.equal(chained.value);

        chained.set(40);
        expect(40).to.equal(chained.value);
        
        expect(25).to.equal(DynamicConfiguration.asChainedProperty("??", 30, "test1").value);
        expect(40).to.equal(DynamicConfiguration.asChainedProperty("???", 40, "???").value);
    });

    it('should refresh new values', async function () {

        let source = new MockConfigurationSource();
        await DynamicConfiguration.manager.forcePollingAsync(source, true);

        let prop = DynamicConfiguration.getProperty("test");
        expect(prop).to.be.undefined;

        source.set("test", 10);
        prop = DynamicConfiguration.getProperty("test");
        expect(prop).to.be.undefined;

        await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

        prop = DynamicConfiguration.getProperty("test");
        expect(prop).not.to.be.undefined;
        expect(10).to.equal(prop.value);
    });

    it('should refresh new chained values', async function () {

            let source = new MockConfigurationSource();
            await DynamicConfiguration.manager.forcePollingAsync(source, true);

            let chained = DynamicConfiguration.asChainedProperty("test10", 30, "test20");
            expect(30).to.equal(chained.value);

            source.set("test20", 20);
            await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

            expect(20).to.equal(chained.value);

            source.set("test10", 10);
            await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

            expect(10).to.equal(chained.value);

            source.set("test10", 11);
            await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

            expect(11).to.equal(chained.value);
    });

    it('should have memory source', async function () {

            let source1 = new MockConfigurationSource();
            await DynamicConfiguration.manager.forcePollingAsync(source1, true);

            let source2 = new MockConfigurationSource();
            await DynamicConfiguration.manager.forcePollingAsync(source2);

            let prop = DynamicConfiguration.asProperty("test30", 0);
            expect(0).to.equal(prop.value);

            source1.set("test30", 10);
            await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

            expect(10).to.equal(prop.value);

            source2.set("test30", 20);
            await DynamicConfiguration.manager.forcePollingAsync(); // Force polling

            expect(20).to.equal(prop.value);
    });
});
