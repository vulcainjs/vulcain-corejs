import {Model, Property} from '../schemas/annotations';

@Model()
export class VerifyTokenParameter {
    @Property({type:"string", required:true})
    apiKey: string;
    @Property({type:"string"})
    tenant: string;
}

export interface ITokenService {
    verifyTokenAsync(data:VerifyTokenParameter): Promise<boolean>;
}

