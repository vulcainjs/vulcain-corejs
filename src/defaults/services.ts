
export interface ITokenService {
    verifyTokenAsync(data): Promise<boolean>;
}

