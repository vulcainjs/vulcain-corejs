// Copyright (c) Zenasoft. All rights reserved.
// Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
import * as rx from 'rx';

/// <summary>
/// A dynamic property
/// </summary>
export interface IDynamicProperty<T>
{
    /**
     * Subscribe on property changed
     */
    propertyChanged: rx.Observable<any>;

    /**
     * Get the current value
     */
    value:T;

    /**
     * Set the local property value. The value is not persisted
     */
    set(value:T);

    /**
     * Property name
     */
    name: string;

    /**
     * Reset to its default value
     */
    reset():void;
}
