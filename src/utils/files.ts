import * as Path from 'path';
import * as fs from 'fs';
import { System } from './../globals/system';

export class Files
{
    static findApplicationPath() {
        let parent = module.parent;
        while (parent.parent) {
            if (fs.existsSync(Path.join(Path.dirname(parent.filename), 'startup.js')) &&
                fs.existsSync(Path.join(Path.dirname(parent.filename), 'index.js')))
                break;
            parent = parent.parent;
        }
        return Path.dirname(parent.filename);
    }

    static traverse( dir:string, callback?:( n, v )=>void, filter?:(fileName)=>boolean )
    {
        if(!filter)
            filter = (fn) => Path.extname( fn ) === ".js";

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