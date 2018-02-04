
export class QueryResult<T=any> {
    constructor(public value: Array<T>, public total?: number) { }
}
