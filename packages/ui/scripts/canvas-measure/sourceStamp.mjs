import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,relative} from 'node:path';
const root=fileURLToPath(new URL('../../',import.meta.url));
/** Scope: all UI source, measurement source/config, and consumed SDK dist bytes. */
export function sourceStamp(){
 const hash=createHash('sha256');
 const visit=(dir,all=false)=>{for(const entry of readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name);if(entry.isDirectory())visit(path,all);else if(all||/\.(?:tsx?|css|m?js|json|html)$/.test(entry.name))hash.update(relative(root,path)).update(readFileSync(path));}};
 visit(join(root,'src'));visit(join(root,'scripts/canvas-measure'));visit(join(root,'../sdk/dist'),true);return hash.digest('hex');
}
