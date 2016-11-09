import { System } from './../globals/system';
import {ConfigurationSource, PollResult} from './configurationSource';
import {DynamicProperty} from '../properties/dynamicProperty';
import {DynamicProperties} from "../properties/dynamicProperties";

export class ConfigurationManager
{
    private _sources:Array<ConfigurationSource> = [];
    private disposed:boolean;
    private _polling:boolean;

    constructor(
        private properties:DynamicProperties,
        public pollingIntervalInSeconds:number,
        public sourceTimeoutInMs:number )
    {
    }

    private ensuresPolling()
    {
        if( !this.disposed && !this._polling)
        {
            this.polling();
            this._polling = true;
        }
    }


    async polling()
    {
        let list = this._sources;
        let results:Array<PollResult> = [];
        if( this.disposed ) return;

        if(list)
        {
            for( let src of list )
            {
                try
                {
                    results.push( await src.pollPropertiesAsync( this.sourceTimeoutInMs ) );
                }
                catch( e )
                {
                    System.log.error(null, e, "CONFIG: Error when polling configuration source ");
                }
            }

            this.loadPropertiesFromSources( results );
        }

        setTimeout( this.polling.bind(this), this.pollingIntervalInSeconds * 1000 );
    }

    private loadPropertiesFromSources( results:Array<PollResult> )
    {
        for( let result of results )
        {
            try {
                if (!result) {
                    continue;
                }
                if( result.values && result.values.size > 0)
                    this.loadProperties( result );

                // First time only
                let src = <any>result.source;
                if( src && src.__onInitialized )
                {
                    src.__onInitialized();
                    delete src.__onInitialized;
                }
            }
            catch( e )
            {
            }
        }
    }

    private loadProperties( props:PollResult )
    {
        if (!props.values) {
            this.properties.clear();
            return;
        }

        props.values.forEach((item, key) => {
            if (!item || item.deleted) {
                System.log.info(null, "CONFIG: Removing property value for key " + key);
                this.properties.Updater_removeProperty(key);
                return;
            }

            try {
                var prop = this.properties.Updater_getOrCreate(key, () => {
                    return new DynamicProperty<any>(this.properties, key);
                });

                prop.set(item.encrypted ? JSON.parse(System.decrypt(item.value)) : item.value);
                System.log.info(null, `CONFIG: Setting property value ${item.value} for key ${key}`);
            }
            catch (e) {
                System.log.error(null, e, `CONFIG: Error on loadProperties for key ${key}`);
            }
        });
    }

    dispose()
    {
        this.disposed = true;
    }

    /**
     * Initialize source(s) and return only when all sources are initialized
     * @param sources List of sources
     * @returns {Promise<T>}
     */
    registerSourcesAsync( sources:Array<ConfigurationSource> )
    {
        return new Promise( ( resolve )=>
        {
            let latch = 0;
            for( let source of sources )
            {
                if( this._sources.indexOf( source ) >= 0 )
                    continue;

                (<any>source).__onInitialized = () =>
                {
                    latch--;
                    if( latch === 0 )
                    {
                        resolve();
                    }
                };
                this._sources.push( source );
                latch++;
            }

            // Run initialization
            this.ensuresPolling();
            if (latch === 0)
                resolve();
        });
    }
}
