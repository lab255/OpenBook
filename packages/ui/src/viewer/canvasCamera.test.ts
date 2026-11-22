import {describe,it,expect} from 'vitest';
import appSource from '../blockeditor/canvas/CanvasBlock.tsx?raw';
import {union,type Camera} from '../blockeditor/canvas/geometry';
import type {SceneShape} from '../blockeditor/canvas/schema';
import {fitCanvas} from './canvasCamera';

describe('export fit camera mirrors app first-view and reset',()=>{
  it('executes the app fit body against the same scenes, including empty/extreme bounds',()=>{
    // The app fits its drawing element's box, not a browser viewport size.
    expect(appSource).toContain('const width=viewport.current!.clientWidth||640;setWidth(width);');
    expect(appSource).toContain('<div ref={viewport} className="ob-canvas-viewport"');
    const body=appSource.match(/const fit=\(\)=>\{([\s\S]*?)\};\n {2}const reveal/)?.[1];
    expect(body).toBeTruthy();
    // Execute trusted repository source so the mirror cannot drift with a copied expectation.
    // eslint-disable-next-line no-new-func
    const appFit=new Function('scene','width','height','union','setCamera',body!) as (scene:{shapes:SceneShape[]},width:number,height:number,union:unknown,set:(camera:Camera)=>void)=>void;
    const initial=appSource.match(/if\(current.scene.shapes.length\)\{([^\n]+)\}/)?.[1];expect(initial).toBeTruthy();
    // eslint-disable-next-line no-new-func -- same trusted-source drift control as above
    const appInitial=new Function('current','width','union','setCamera',initial!) as (current:{scene:{shapes:SceneShape[]};height:number},width:number,union:unknown,set:(camera:Camera)=>void)=>void;
    const shape=(x:number,y:number,w:number,h:number)=>({id:'r',scalars:{kind:'rect',x,y,w,h},points:[],pointArity:2}) as unknown as SceneShape;
    const stroke={...shape(-31.2,40.7,81.1,97.3),scalars:{kind:'stroke',x:-31.2,y:40.7,w:81.1,h:97.3,basisW:13,basisH:17},points:[-2,3,255,7,19,0,11,-5,127],pointArity:3} as unknown as SceneShape;
    const arrow={...shape(0,0,1,1),scalars:{kind:'arrow',x:-10.1,y:7.9,w:130.3,h:0,startX:1,startY:0,endX:0,endY:1}} as unknown as SceneShape;
    for(const shapes of [[stroke],[arrow],[stroke,arrow],[],[shape(15,40,440,70)],[shape(-200,-90,80,100),shape(500,200,0,0)],[shape(0,0,1,1)],[shape(0,0,10000,10000)]])for(const width of [204,624,672]){
      let expected:Camera={x:0,y:0,zoom:1};appFit({shapes},width,360,union,c=>{expected=c;});
      expect(fitCanvas(shapes,width,360)).toEqual(expected);
      let first:Camera={x:0,y:0,zoom:1};if(shapes.length)appInitial({scene:{shapes},height:360},width,union,c=>{first=c;});expect(first).toEqual(expected);
    }
    expect(fitCanvas([],624,360)).toEqual({x:0,y:0,zoom:1});
    expect(fitCanvas([shape(15,40,440,70)],624,360)).not.toEqual({x:0,y:0,zoom:1});
  });
});
