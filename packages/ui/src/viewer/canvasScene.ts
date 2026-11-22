import * as Y from 'yjs';
import {canvasDefaults, get, scalarValue, shapeDefaults, validatePointValues, type SceneShape} from '@/blockeditor/canvas/schema';
export {get, projectCanvas} from '@/blockeditor/canvas/schema';

/** Committed-input validation only. No editable identity, command validation,
 * constructors, recovery mutations or document writes. Scalars and pressure
 * retain the app reader's exact validation and normalization contracts. */
export function readViewerCanvas(props:unknown):{shapes:SceneShape[];diagnostics:string[]} {
  const shapes:SceneShape[]=[],diagnostics:string[]=[];
  for(const key of Object.keys(canvasDefaults)) {
    try {scalarValue(key,get(props,key),true);} catch {diagnostics.push(`Invalid canvas ${key}`);}
  }
  const source=get(props,'shapes');
  const entries=source instanceof Y.Map?[...source]:source&&typeof source==='object'&&!Array.isArray(source)?Object.entries(source):null;
  if(!entries)diagnostics.push('Invalid canvas shapes');
  for(const [id,value] of entries??[]) {
    try {
      const scalars:Record<string,string|number>={};
      for(const key of Object.keys(shapeDefaults))scalars[key]=scalarValue(key,get(value,key));
      if(scalars.id!==id)throw new Error('Identity');
      const raw=get(value,'points'),points=raw instanceof Y.Array?raw.toArray():raw;
      validatePointValues(points,scalars.pressureMode,get(value,'pointArity')??(value instanceof Y.Map?undefined:2));
      shapes.push({id,scalars,points,pointArity:scalars.pressureMode==='variable'?3:2});
    }catch(error){diagnostics.push(`Quarantined shape ${id}: ${error instanceof Error?error.message:'invalid'}`);}
  }
  shapes.sort((a,b)=>a.scalars.ord<b.scalars.ord?-1:a.scalars.ord>b.scalars.ord?1:a.id<b.id?-1:a.id>b.id?1:0);
  return {shapes,diagnostics};
}
