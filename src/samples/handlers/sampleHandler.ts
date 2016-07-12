import {Command} from '../../pipeline/commands';
import {CommandHandler, Action, EventHandler, Consume} from '../../pipeline/annotations';
import {ValidationError, RuntimeError} from '../../pipeline/common';
import {Property, Model} from '../../schemas/annotations'
import {AbstractCommandHandler, AbstractEventHandler} from '../../index';

@Model("Customer", { storageName: "customers" })
export class Customer {
    @Property({ type: "string", required: true })
    firstName: string;
    @Property({ type: "string", required: true, isKey: true })
    lastName: string;
}

@CommandHandler({ async: false, scope: "*", schema:"Customer" })
export class CustomerHandler extends AbstractCommandHandler {

    @Action({action:"createCustomer"})
    async createCustomerAsync(customer: Customer) {

        return true;
    }
}

@EventHandler({ schema:"Customer" })
export class CustomerEventHandler extends AbstractEventHandler {

    @Consume({action:"createCustomer"})
    async onCreateCustomerAsync(event) {
        return true;
    }
}