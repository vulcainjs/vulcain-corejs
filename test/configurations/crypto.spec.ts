import { CryptoHelper } from '../../dist/utils/crypto';
import { expect } from 'chai';
import * as sinon from 'sinon';

let plainText = "abcdefghijklmnopqrstuvwxyz\n";
let expected = "v2/wO9VusPOh9vaiokZZf1pBAwYwqPan6CzN";
let crypto = new CryptoHelper();

describe('CryptoHelper', function () {

    it('should encrypt a value', function () {
        expect(crypto.encrypt(plainText)).to.equal(expected);
    });

    it('should decrypt a value', function () {
        expect(crypto.decrypt(expected)).to.equal(plainText);
    });
});
