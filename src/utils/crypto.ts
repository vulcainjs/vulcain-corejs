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
        let cipher = crypto.createCipheriv('aes-256-cbc', this.secretKey.value, iv);
        let encrypted: Buffer = cipher.update(value);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('base64') + ":" + encrypted.toString('base64');
    }

    decrypt(value: string) {
        let parts = value.split(':');
        let iv = Buffer.from(parts.shift(), 'base64');
        let encryptedText = Buffer.from(parts.join(':'), 'base64');
        let decipher = crypto.createDecipheriv('aes-256-cbc', this.secretKey.value, iv);
        let decrypted: Buffer = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}
