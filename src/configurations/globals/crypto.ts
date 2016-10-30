import { System } from './system';
import * as fs from "fs";
import * as crypto from 'crypto';
import {DynamicConfiguration} from '../dynamicConfiguration';
import {IDynamicProperty} from '../dynamicProperty';
import { Conventions } from '../../utils/conventions';

export class CryptoHelper {

    private secretKey: string;

    constructor() {
        this.secretKey = System.createSharedConfigurationProperty(Conventions.instance.secretKeyPropertyName,
            process.env[Conventions.instance.ENV_VULCAIN_SECRET_KEY] || Conventions.instance.defaultSecretKey).value;
    }

    encrypt(value) {
        let cipher = crypto.createCipher('aes-256-ctr', this.secretKey);
        let encrypted = cipher.update(value, 'utf8', 'binary');
        encrypted += cipher.final('binary');
        let hexVal = new Buffer(encrypted, 'binary');
        return hexVal.toString('base64');
    }

    decrypt(value) {
        let decipher = crypto.createDecipher('aes-256-ctr', this.secretKey);
        let decrypted = decipher.update(value, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}
