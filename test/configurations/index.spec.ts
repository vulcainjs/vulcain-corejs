import { expect } from 'chai';
import { DynamicConfiguration } from '../../src/configurations/dynamicConfiguration';
import { MockConfigurationSource } from '../../src/configurations/sources/memoryConfigurationSource';
import { DynamicProperty } from '../../src/configurations/properties/dynamicProperty';

describe('DynamicConfiguration', function () {

    it('should have default values', function () {
        DynamicConfiguration.reset(1);
        let p = DynamicConfiguration.getProperty("test", 10);
        expect(p.value).to.equal(10);
    });

    it('should create property', function () {
        DynamicConfiguration.reset(1);

        let prop = DynamicConfiguration.getProperty("test", 10);
        expect(prop).not.to.be.null;
        expect(10).to.be.equal(prop.value);
        let p = DynamicConfiguration.getProperty("test");
        expect(10).to.equal(p.value);
        let prop2 = DynamicConfiguration.getProperty("test");
        expect(prop2).not.to.be.null;
        expect(prop.value).to.equal(prop2.value);
    });

    it('should raise changed event', () => {

        let cx = 0;
        DynamicConfiguration.reset();
        DynamicConfiguration.propertyChanged
            .filter( p => p.name === "test")
            .subscribe((property) => {
                cx += property.value;
            });

        let prop = DynamicConfiguration.getProperty("test", 10);
        prop.set(15);
        let prop2 = DynamicConfiguration.getProperty("test2", 10);
        prop.set(20);

        expect(10 + 15 + 20).to.equal(cx);
        expect(20).to.equal(prop.value);
    });

    it('should support different types', function () {
        DynamicConfiguration.reset(1);

        expect(10).to.equal(DynamicConfiguration.getProperty("test", 10).value);
        expect(2.0).to.equal(DynamicConfiguration.getProperty("test2", 2.0).value);
        expect("xxx").to.equal(DynamicConfiguration.getProperty("test3", "xxx").value);
        expect(true).to.equal(DynamicConfiguration.getProperty("test4", true).value);
        let v2 = [1, 2, 3];
        expect(v2).to.equal(DynamicConfiguration.getProperty("test6", v2).value);
    });

    it('should chain values', function () {
        DynamicConfiguration.reset(1);

        let chained = DynamicConfiguration.getChainedProperty("test", 30, "test1");
        expect(30).to.equal(chained.value);

        let prop2 = DynamicConfiguration.getProperty("test1", 20);
        expect(20).to.equal(chained.value);

        prop2.set(25);
        expect(25).to.equal(chained.value);

        chained.set(40);
        expect(40).to.equal(chained.value);

        expect(25).to.equal(DynamicConfiguration.getChainedProperty("??", 30, "test1").value);
        expect(40).to.equal(DynamicConfiguration.getChainedProperty("???", 40, "???").value);
    });

    it('should refresh new values', async function () {
        let manager = DynamicConfiguration.reset(1);

        let source = new MockConfigurationSource();
        await manager.forcePolling(source, true);

        let prop = DynamicConfiguration.getProperty("test");
        expect(prop.value).to.be.undefined;

        source.set("test", 10);
        prop = DynamicConfiguration.getProperty("test");
        expect(prop.value).to.be.undefined;

        await manager.forcePolling(); // Force polling

        prop = DynamicConfiguration.getProperty("test");
        expect(10).to.equal(prop.value);
    });

    it('should refresh new chained values', async function () {
        let manager = DynamicConfiguration.reset(1);

            let source = new MockConfigurationSource();
            await manager.forcePolling(source, true);

            let chained = DynamicConfiguration.getChainedProperty("test10", 30, "test20");
            expect(30).to.equal(chained.value);

            source.set("test20", 20);
            await manager.forcePolling(); // Force polling

            expect(20).to.equal(chained.value);

            source.set("test10", 10);
            await manager.forcePolling(); // Force polling

            expect(10).to.equal(chained.value);

            source.set("test10", 11);
            await manager.forcePolling(); // Force polling

            expect(11).to.equal(chained.value);
    });

    it('should have memory source', async function () {
        let manager = DynamicConfiguration.reset(1);

            let source1 = new MockConfigurationSource();
            await manager.forcePolling(source1, true);

            let source2 = new MockConfigurationSource();
            await manager.forcePolling(source2);

            let prop = DynamicConfiguration.getProperty("test30", 0);
            expect(0).to.equal(prop.value);

            source1.set("test30", 10);
            await manager.forcePolling(); // Force polling

            expect(10).to.equal(prop.value);

            source2.set("test30", 20);
            await manager.forcePolling(); // Force polling

            expect(20).to.equal(prop.value);
    });
});
