import { CryptoHelper } from '../../dist/globals/crypto';
import { expect } from 'chai';
import * as sinon from 'sinon';

let plainText = "abcdefghijklmnopqrstuvwxyz\n";
let expected = "v2/wO9VusPOh9vaiokZZf1pBAwYwqPan6CzN";

describe('CryptoHelper', function () {

    it('should encrypt a value', function () {
        let crypto = new CryptoHelper();
        expect(crypto.encrypt(plainText)).to.equal(expected);
    });

    it('should decrypt a value', function () {
        let crypto = new CryptoHelper();
        expect(crypto.decrypt(expected)).to.equal(plainText);
    });

});
