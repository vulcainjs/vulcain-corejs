import { System } from '../globals/system';
import * as crypto from 'crypto';
import { Conventions } from '../utils/conventions';
import { IDynamicProperty } from '../configurations/abstractions';
import { DynamicConfiguration } from '../configurations/dynamicConfiguration';

export class CryptoHelper {
    private static IV_LENGTH = 16;
    private secretKey: IDynamicProperty<string>;

    constructor() {
        this.secretKey = DynamicConfiguration.getChainedConfigurationProperty(
            Conventions.instance.VULCAIN_SECRET_KEY, Conventions.instance.defaultSecretKey);
    }

    encrypt(value) {
        let iv = crypto.randomBytes(CryptoHelper.IV_LENGTH);
        let cipher = crypto.createCipheriv('aes-256-ctr', this.secretKey.value, iv);
        let encrypted: Buffer = cipher.update(value);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ":" + encrypted.toString('hex');
    }

    decrypt(value: string) {
        let parts = value.split(':');
        let iv = new Buffer(parts.shift(), 'hex');
        let encryptedText = new Buffer(parts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-ctr', this.secretKey.value, iv);
        let decrypted: Buffer = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}
