import {pointBounds,type Camera} from '@/blockeditor/canvas/geometry';
import {viewerPoints,viewerEndpoints} from './canvasPaint';
import type {SceneShape} from '@/blockeditor/canvas/schema';

// Read-only bounds reuse the painter's validated points; no authoring coercion.
function union(shapes:readonly SceneShape[]) {
  return pointBounds(shapes.flatMap(s=>{
    const v=s.scalars as unknown as {kind:string;x:number;y:number;w:number;h:number};
    const b=v.kind==='stroke'?pointBounds(viewerPoints(s)):v.kind==='arrow'?pointBounds(viewerEndpoints(s)):v;
    return [{x:b.x,y:b.y},{x:b.x+b.w,y:b.y+b.h}];
  }));
}
/** Mirrors CanvasBlock's initial/fit action; drift-tested against its source. */
export function fitCanvas(shapes:readonly SceneShape[],width:number,height:number):Camera {
  if(!shapes.length)return {x:0,y:0,zoom:1};
  const b=union(shapes),zoom=Math.min(4,Math.max(.1,Math.min((width-40)/Math.max(1,b.w),(height-40)/Math.max(1,b.h))));
  return {zoom,x:(width-b.w*zoom)/2-b.x*zoom,y:(height-b.h*zoom)/2-b.y*zoom};
}
