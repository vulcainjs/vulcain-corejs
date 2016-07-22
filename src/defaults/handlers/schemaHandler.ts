import {QueryHandler, Query} from '../../pipeline/annotations';
import { QueryData, Command, AbstractQueryHandler, Domain, Schema, DefaultServiceNames, Inject, IContainer} from '../../index';


export class DefaultQueryHandler extends AbstractQueryHandler {

    constructor( @Inject(DefaultServiceNames.Domain) protected domain: Domain) {
        super();
    }

    @Query({ action: "get" })
    getAsync(name: string) {
        return this.domain.getSchema(name);
    }

    @Query({ action: "search" })
    getAllAsync(query: any, maxByPage: number = 0, page?: number) {
        let options = { maxByPage: maxByPage || this.query.maxByPage, page: page || this.query.page, query: query };
        return this.domain.schemas;
    }
}
