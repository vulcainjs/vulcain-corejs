// Copyright (c) Zenasoft. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
import {DynamicProperty} from './dynamicProperty'
import {IDynamicProperty} from '../dynamicProperty'
import {DynamicProperties} from './dynamicProperties'
import {PropertiesFactory as IPropertiesFactory} from '../propertiesFactory'
import {ChainedDynamicProperty} from "./chainedDynamicProperty";

export class PropertiesFactory implements IPropertiesFactory
{
    constructor(private _properties:DynamicProperties)
    {
    }

    private add(name:string, prop: IDynamicProperty<any>)
    {
        this._properties.addProperty(name, prop);
    }

    public asProperty<T>(value:T, name?:string) : IDynamicProperty<T>
    {
        if (name && this._properties.getProperty(name))
        {
            throw new Error("Duplicate property name");
        }
        
        var p = new DynamicProperty<T>(this._properties, name, value);
        if (name)
            this.add(name, p);
        p.set(value); // To send propertychanged
        return p;
    }

    public asChainedProperty<T>(defaultValue:T, name:string, fallbackPropertyNames:Array<string>) : IDynamicProperty<T>
    {
        if(fallbackPropertyNames.length == 0) throw new Error("You must provide at least one fallback property name");

        var properties = [name].concat(fallbackPropertyNames);
        var p = new ChainedDynamicProperty<T>(this._properties, properties, defaultValue);
        return p;
    }
}