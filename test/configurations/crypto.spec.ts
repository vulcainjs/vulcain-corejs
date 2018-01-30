import { CryptoHelper } from '../../src/utils/crypto';
import { expect } from 'chai';

let plainText = "abcdefghijklmnopqrstuvwxyz\n";
let crypto = new CryptoHelper();

describe('CryptoHelper', function () {

    it('should decrypt an encrypted value', function () {
        let encrypted = crypto.encrypt(plainText);
        expect(crypto.decrypt(encrypted)).to.equal(plainText);
    });
});
