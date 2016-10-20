// Copyright (c) Zenasoft. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.

/// <summary>
/// Provides methods to create a property
/// </summary>
import {IDynamicProperty} from "./dynamicProperty";

export interface PropertiesFactory
{
    /// <summary>
    /// Create a new dynamic property
    /// </summary>
    /// <typeparam name="T">Property type</typeparam>
    /// <param name="value">Default value</param>
    /// <param name="name">Property name</param>
    /// <returns>A dynamic property instance</returns>
    asProperty<T>(value, name?:string) : IDynamicProperty<T>;
    /// <summary>
    /// Create a new chained dynamic property
    /// </summary>
    /// <typeparam name="T">Property type</typeparam>
    /// <param name="propertyName">Main property name</param>
    /// <param name="defaultValue">Default value</param>
    /// <param name="fallbackPropertyNames">List of properties to chain. The first is the main property</param>
    /// <returns>A dynamic property instance</returns>
    asChainedProperty<T>(defaultValue, propertyName:string, fallbackPropertyNames:Array<string>):IDynamicProperty<T>;
}