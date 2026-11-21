import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
/** Scope: all UI source plus measurement source/config, excluding output files. */
export function sourceStamp(){
 const hash=createHash('sha256');
 const visit=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name);if(entry.isDirectory())visit(path);else if(/\.(?:tsx?|css|mjs|html)$/.test(entry.name))hash.update(relative(root,path)).update(readFileSync(path));}};
 visit(join(root,'src'));visit(join(root,'scripts/canvas-measure'));return hash.digest('hex');
}
