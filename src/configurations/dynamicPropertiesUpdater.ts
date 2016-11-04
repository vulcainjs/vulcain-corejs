import { IDynamicProperty } from './dynamicProperty';

/// <summary>
/// Interface used by <see cref="ConfigurationManager"/> to update properties
/// </summary>
export interface DynamicPropertiesUpdater
{
    /// <summary>
    /// Remove an unused property
    /// </summary>
    /// <param name="name"></param>
    Updater_removeProperty(name:string);

    /// <summary>
    /// Get or create a property
    /// </summary>
    /// <param name="key">Property name</param>
    /// <param name="factory">Property factory</param>
    /// <returns></returns>
    Updater_getOrCreate(key:string, factory:()=>IDynamicProperty<any>):IDynamicProperty<any>;
}