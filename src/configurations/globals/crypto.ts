import { System } from './system';
import * as crypto from 'crypto';
import { Conventions } from '../../utils/conventions';
import { IDynamicProperty } from '../../configurations/dynamicProperty';

export class CryptoHelper {

    private secretKey: IDynamicProperty<string>;

    constructor() {
        this.secretKey = System.createSharedConfigurationProperty(
            Conventions.instance.ENV_VULCAIN_SECRET_KEY, "string", Conventions.instance.defaultSecretKey);
    }

    encrypt(value) {
        let cipher = crypto.createCipher('aes-256-ctr', this.secretKey.value);
        let encrypted = cipher.update(value, 'utf8', 'binary');
        encrypted += cipher.final('binary');
        let hexVal = new Buffer(encrypted, 'binary');
        return hexVal.toString('base64');
    }

    decrypt(value) {
        let decipher = crypto.createDecipher('aes-256-ctr', this.secretKey.value);
        let decrypted = decipher.update(value, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
