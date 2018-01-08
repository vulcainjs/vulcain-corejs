import { expect } from 'chai';
import { MongoQueryParser } from '../../dist/providers/memory/mongoQueryParser';

let entity = { name: "entity", num: 10, address: { street: "street1", city: "Paris" }, tags: ["a", "b"] };
let products = [{ _id: 1, results: [{ product: "abc", score: 10 }, { product: "xyz", score: 5 }] },
{ _id: 2, results: [{ product: "abc", score: 8 }, { product: "xyz", score: 7 }] },
{ _id: 3, results: [{ product: "abc", score: 7 }, { product: "xyz", score: 8 }] }
];

describe("MemoryProvider", function () {

    it("should filter correctly", () => {
        let p = new MongoQueryParser({ name: "entity" });
        expect(p.execute(entity)).to.be.true;
        p = new MongoQueryParser({ $or: [{ num: 11 }, { name: "entity" }] });
        expect(p.execute(entity)).to.be.true;
        p = new MongoQueryParser({ name: "entity", num: 12 });
        expect(p.execute(entity)).to.be.false;
        p = new MongoQueryParser({ key: /shared\./, system: { "$ne": true }, deleted: { "$ne": true } });
        expect(p.execute(entity)).to.be.false;
    });

    it("should filter elemMatch", () => {
        let filter = { results: { $elemMatch: { product: "xyz", score: { $gte: 8 } } } };
        let p = new MongoQueryParser(filter);
        expect(p.execute(products[0])).to.be.false;
        expect(p.execute(products[1])).to.be.false;
        expect(p.execute(products[2])).to.be.true;
    });

    it("should filter by query operator", () => {
        let p = new MongoQueryParser({ results: { $size: 2 } });
        expect(p.execute(products[0])).to.be.true;
        p = new MongoQueryParser({ tags: { $in: ["a"] } });
        expect(p.execute(entity)).to.be.true;
        p = new MongoQueryParser({ num: { $in: [10, 20] } });
        expect(p.execute(entity)).to.be.true;
    });
});


