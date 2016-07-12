import './handlers/apiHandler';
import './handlers/tokenHandler';
import './handlers/userHandler';
import {IContainer, DefaultServiceNames} from '../core';
import {Authentication} from './expressAuthentication';

export class AccountManagement {
    static init(container:IContainer) {
        container.injectSingleton(Authentication, DefaultServiceNames.Authentication);
    }
}