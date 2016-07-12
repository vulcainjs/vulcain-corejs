import {User} from './models/user';

export interface IApiKeyService {
    verifyTokenAsync(data): Promise<boolean>;
}

export interface ITokenService {
    verifyTokenAsync(data): Promise<boolean>;
}

export interface IUserService {
    verifyPasswordAsync(original, pwd): Promise<boolean>;
    getUserAsync(name: string): Promise<User>;
    hasUsersAsync(): Promise<boolean>;
}