import { Model, Property } from '../schemas/annotations';
import { UserContext } from '../servers/requestContext';

@Model()
export class VerifyTokenParameter {
    @Property({ type: "string", required: true })
    token: string;
    @Property({ type: "string" })
    tenant: string;
}

export interface ITokenService {
    verifyTokenAsync(data: VerifyTokenParameter): Promise<any>;
    createTokenAsync(user: UserContext): Promise<string>;
}

