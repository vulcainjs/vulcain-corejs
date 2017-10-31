import * as Path from 'path';
import * as fs from 'fs';
import { System } from './../globals/system';
import { Conventions } from './conventions';

export class Files
{
    private static _configFilePath: string|undefined|null;
    static findConfigurationFile() {
        if (Files._configFilePath === undefined)
            return Files._configFilePath;

        let fileName = Conventions.instance.vulcainFileName;
        let filePath = Path.join(process.cwd(), fileName);
        if (fs.existsSync(filePath))
        {
            return Files._configFilePath = filePath;
        }

        return Files._configFilePath = null;
    }

    static traverse(dir: string, callback?: (n, v) => void, filter?: (fileName) => boolean)
    {
        if(!filter)
            filter = (fn) => Path.extname( fn ) === ".js" && fn[0] !== "_";

        if( fs.existsSync( dir ) )
        {
             fs.readdirSync( dir ).forEach( fn =>
             {
                 if( filter(fn) )
                 {
                     try
                     {
                         let c = require( Path.join( dir, fn ) );
                         if( !c || !callback) return;
                         for( let ctl in c )
                         {
                             callback( ctl, c[ctl] );
                         }
                     }
                     catch(err)
                     {
                         System.log.error(null, err, ()=> `ERROR when trying to load component ${fn}`);
                         process.exit(1);
                     }
                 }
                 else
                 {
                     let fullPath = Path.join( dir, fn );
                     if( fs.statSync( fullPath ).isDirectory() )
                     {
                         Files.traverse( Path.join( dir, fn ), callback );
                     }
                 }
             });
        }
    }
}