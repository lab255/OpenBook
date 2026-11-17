import * as Y from 'yjs';
import {canvasDefaults,constructCanvasProps,createShape,readCanvas} from '../../src/blockeditor/canvas/schema';
import {CommittedSceneCache} from '../../src/blockeditor/canvas/paintCache';
import {paint,paintShape} from '../../src/blockeditor/canvas/geometry';

const diff=(a:Uint8ClampedArray,b:Uint8ClampedArray,width:number)=>{
  let maximum=0,pixels=0;const examples:unknown[]=[];let minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
  for(let i=0;i<a.length;i+=4){const delta=Math.max(...[0,1,2,3].map(k=>Math.abs(a[i+k]-b[i+k])));if(!delta)continue;pixels++;const x=(i/4)%width,y=Math.floor(i/4/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(delta>=maximum){if(delta>maximum)examples.length=0;maximum=delta;if(examples.length<12)examples.push({x,y,actual:[...a.slice(i,i+4)],reference:[...b.slice(i,i+4)]});}}
  return {maximum,pixels,bounds:pixels?{minX,minY,maxX,maxY}:null,examples};
};
export function rasterDiagnosis(){
  const rows=[];
  for(const mode of ['all','rect','ellipse','arrow','text','stroke'])for(const zoom of [1,1.25,2]){
    const props=constructCanvasProps({...canvasDefaults,shapes:{}}),doc=new Y.Doc();doc.getMap('r').set('p',props);const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
    const kinds=mode==='all'?['rect','ellipse','arrow','text','stroke']:[mode];
    for(const [i,kind] of kinds.entries())shapes.set(String(i),createShape({id:String(i),kind,x:20+i*12,y:30+i*8,w:80,h:60,fill:'#e2e8f0',opacity:.7,text:'Wrap me',points:kind==='stroke'?[0,0,10,20,30,5]:[]}));
    const cached=document.createElement('canvas'),reference=document.createElement('canvas'),cache=new CommittedSceneCache(),camera={x:10,y:5,zoom};
    const width=300,height=240;
    cache.draw(cached,readCanvas(props).shapes,[],camera,width,height);
    shapes.get('0')!.set('x',50);
    const scene=readCanvas(props).shapes;
    cache.draw(cached,scene,[],camera,width,height);paint(reference,scene,camera,width,height);
    const layer=(cache as unknown as {layer:HTMLCanvasElement}).layer;
    const read=(canvas:HTMLCanvasElement)=>canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;
    const beforeLayer=read(layer),beforeComposite=read(cached),expected=read(reference);
    const partialVsReference=diff(beforeLayer,expected,cached.width),compositeVsLayer=diff(beforeComposite,beforeLayer,cached.width);
    paint(layer,scene,camera,width,height);
    const fullCacheVsReference=diff(read(layer),expected,cached.width);
    // Isolate clipping from compositing and retained pixels: fresh canvas,
    // same ordered draws, with only an integer-aligned screen-space clip added.
    const clipped=document.createElement('canvas');clipped.width=reference.width;clipped.height=reference.height;
    const clippedContext=clipped.getContext('2d')!,ratio=window.devicePixelRatio;
    const clip={x:30,y:37,w:148,h:86};
    clippedContext.setTransform(1,0,0,1,0,0);clippedContext.beginPath();clippedContext.rect(clip.x,clip.y,clip.w,clip.h);clippedContext.clip();
    clippedContext.setTransform(ratio,0,0,ratio,0,0);clippedContext.translate(camera.x,camera.y);clippedContext.scale(camera.zoom,camera.zoom);for(const shape of scene)paintShape(clippedContext,shape);
    const clippedPixels=read(clipped),cropped=expected.slice();
    for(let y=0;y<clipped.height;y++)for(let x=0;x<clipped.width;x++)if(x<clip.x||x>=clip.x+clip.w||y<clip.y||y>=clip.y+clip.h)cropped.fill(0,(y*clipped.width+x)*4,(y*clipped.width+x+1)*4);
    const freshClippedVsCroppedReference=diff(clippedPixels,cropped,clipped.width);
    rows.push({mode,zoom,dpr:window.devicePixelRatio,dimensions:{layer:[layer.width,layer.height],main:[cached.width,cached.height]},partialVsReference,compositeVsLayer,fullCacheVsReference,freshClippedVsCroppedReference});
  }
  return rows;
}
