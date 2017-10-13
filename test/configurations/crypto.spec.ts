import { CryptoHelper } from '../../dist/utils/crypto';
import { expect } from 'chai';
import * as sinon from 'sinon';

let plainText = "abcdefghijklmnopqrstuvwxyz\n";
let crypto = new CryptoHelper();

describe('CryptoHelper', function () {

    it('should decrypt an encrypted value', function () {
        let encrypted = crypto.encrypt(plainText);
        expect(crypto.decrypt(encrypted)).to.equal(plainText);
    });
});
