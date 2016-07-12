// http://chaijs.com/
import { expect } from 'chai';

beforeEach(async function() {
});

describe("MyTest1", function () {

    it("asynchronus test", async function (done) {
        try
        {
            done();
        }
        catch (e) {
            done(e);
        }
    });

    it("synchro test", function () {

    });
});
