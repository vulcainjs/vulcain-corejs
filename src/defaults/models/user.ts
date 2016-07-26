import {Property, Model, Reference} from '../../index';

@Model("User")
export class User
{
    @Property({type:"string", isKey:true})
    id:string;
    @Property({type:"string", required:true})
    name:string;
    @Property({type:"string", required:false, serialize:false})
    password:string;
    @Property({type:"string"})
    displayName:string;
    @Property({type:"string"})
    email:string;
    @Property({type:"arrayOf", item: "string"})
    scopes: Array<string>;
    @Reference({item:"any", cardinality:"one"})
    data: any;
    @Property({type:"boolean"})
    disabled:boolean;
}