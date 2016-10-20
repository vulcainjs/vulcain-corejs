import { System } from './system';
import * as fs from "fs";
import * as crypto from 'crypto';
import {DynamicConfiguration} from '../dynamicConfiguration';
import {IDynamicProperty} from '../dynamicProperty';

export class CryptoHelper {

    private secretKey: string;

    constructor() {
        this.secretKey = System.createSharedConfigurationProperty("VulcainSecretKey",
            process.env["VULCAIN_SECRET_KEY"] || "DnQBnCG7*fjEX@Rw5uN^hWR4*AkRVKMeRu2#Ucu^ECUNWrKr").value;
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
