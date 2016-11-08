import { DynamicProperties } from '../../dist/configurations/properties/dynamicProperties';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DynamicConfiguration } from '../../dist/configurations/dynamicConfiguration';
import { MemoryConfigurationSource } from '../../dist/configurations/configurationSources/memoryConfigurationSource';

describe('DynamicConfiguration', function () {

    beforeEach(function () {
        DynamicConfiguration.instance.reset(1);
    });

    it('should have default values', function () {

        expect(DynamicConfiguration.getProperty("test")).to.be.undefined;
        var p = DynamicConfiguration.getOrCreateProperty("test", 0);
        expect(p.value).to.equal(0);
    });

    it('should create property', function () {

        var prop = DynamicConfiguration.asProperty(10, "test");
        expect(prop).not.to.be.null;
        expect(10).to.be.equal(prop.value);
        var p = DynamicConfiguration.getOrCreateProperty("test", 0);
        expect(10).to.equal(p.value);
        var prop2 = DynamicConfiguration.getProperty("test");
        expect(prop2).not.to.be.null;
        expect(prop.value).to.equal(prop2.value);
    });

    it('should thrown on duplicate property', function () {

        var prop = DynamicConfiguration.asProperty(10, "test");
        expect(() => {
            var prop2 = DynamicConfiguration.asProperty(10, "test");
        }
        ).to.throw();
    });

    it('should raise changed event', function () {

        var cx = 0;
        DynamicProperties.instance.propertyChanged.subscribe((property) => {
            if (property.name === "test") cx += property.value;
        }
        );

        var prop = DynamicConfiguration.asProperty(10, "test");
        prop.set(15);
        var prop2 = DynamicConfiguration.asProperty(10, "test2");
        prop.set(20);
        expect(10 + 15 + 20).to.equal(cx);
        expect(20).to.equal(prop.value);
    });

    it('should support different types', function () {


        expect(10).to.equal(DynamicConfiguration.asProperty(10, "test").value);
        expect(2.0).to.equal(DynamicConfiguration.asProperty(2.0, "test2").value);
        expect("xxx").to.equal(DynamicConfiguration.asProperty("xxx", "test3").value);
        expect(true).to.equal(DynamicConfiguration.asProperty(true, "test4").value);
        var v2 = [1, 2, 3];
        expect(v2).to.equal(DynamicConfiguration.asProperty(v2, "test6").value);
    });

    it('should chain values', function () {

        var chained = DynamicConfiguration.asChainedProperty(30, "test", "test1");
        expect(30).to.equal(DynamicConfiguration.asChainedProperty(30, "test", "test1").value);

        var prop2 = DynamicConfiguration.asProperty(20, "test1");
        expect(20).to.equal(chained.value);

        chained.set(40);
        prop2.set(25);
        expect(40).to.equal(chained.value);

        var prop = DynamicConfiguration.asProperty(10, "test");
        expect(10).to.equal(chained.value);

        expect(25).to.equal(DynamicConfiguration.asChainedProperty(30, "??", "test1").value);
        expect(40).to.equal(DynamicConfiguration.asChainedProperty(40, "??", "???").value);
    });

    it('should refresh new values', async function (done) {
        try {

            var source = new MemoryConfigurationSource();
            await DynamicConfiguration.instance.registerSourceAsync(source);

            var prop = DynamicConfiguration.instance.getProperty("test");
            expect(prop).to.be.undefined;

            source.set("test", 10);
            prop = DynamicConfiguration.instance.getProperty("test");
            expect(prop).to.be.undefined;

            await DynamicProperties.__forcePollingAsync();

            prop = DynamicConfiguration.instance.getProperty("test");
            expect(prop).not.to.be.undefined;
            expect(10).to.equal(prop.value);
            done();
        }
        catch (err) {
            done(err);
        }
    });

    it('should refresh new chained values', async function (done) {
        try {

            var source = new MemoryConfigurationSource();
            await DynamicConfiguration.instance.registerSourceAsync(source);

            var chained = DynamicConfiguration.asChainedProperty(30, "test10", "test20");
            expect(30).to.equal(DynamicConfiguration.asChainedProperty(30, "test10", "test20").value);

            source.set("test20", 20);
            await DynamicProperties.__forcePollingAsync();
            expect(20).to.equal(chained.value);

            source.set("test10", 10);
            await DynamicProperties.__forcePollingAsync();
            expect(10).to.equal(chained.value);

            source.set("test10", 11);
            await DynamicProperties.__forcePollingAsync();
            expect(11).to.equal(chained.value);
            done();
        }
        catch (err) {
            done(err);
        }
    });

    it('should have memory source', async function (done) {
        try {

            var source1 = new MemoryConfigurationSource();
            await DynamicConfiguration.instance.registerSourceAsync(source1);

            var source2 = new MemoryConfigurationSource();
            await DynamicConfiguration.instance.registerSourceAsync(source2);

            var prop = DynamicConfiguration.instance.getOrCreateProperty("test30", 0);
            expect(0).to.equal(prop.value);

            source1.set("test30", 10);
            await DynamicProperties.__forcePollingAsync();
            expect(10).to.equal(prop.value);

            source2.set("test30", 20);
            await DynamicProperties.__forcePollingAsync();
            expect(20).to.equal(prop.value);
            done();
        }
        catch (err) {
            done(err);
        }
    });
});
