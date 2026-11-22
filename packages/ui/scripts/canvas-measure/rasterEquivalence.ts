import * as Y from 'yjs';
import {keyBetween} from '@book.dev/sdk';
import {canvasDefaults,constructCanvasProps,createShape,readCanvas,type SceneShape} from '../../src/blockeditor/canvas/schema';
import {CommittedSceneCache} from '../../src/blockeditor/canvas/paintCache';
import {paint} from '../../src/blockeditor/canvas/geometry';

/** Exact pixel comparison. The only gesture allowance is the active stroke's
 * nonzero-alpha footprint, independently rendered to a mask. */
export function rasterEquivalence(){
  const rows=[];
  const read=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const delta=(a:Uint8ClampedArray,b:Uint8ClampedArray,mask?:Uint8ClampedArray)=>{
    let changedPixels=0,outsideActivePixels=0,maxChannelDelta=0;
    for(let i=0;i<a.length;i+=4){let different=false;for(let k=0;k<4;k++){const d=Math.abs(a[i+k]-b[i+k]);if(d)different=true;maxChannelDelta=Math.max(maxChannelDelta,d);}if(different){changedPixels++;if(!mask||mask[i+3]===0)outsideActivePixels++;}}
    return {changedPixels,outsideActivePixels,maxChannelDelta};
  };
  let negativeControl=0;
  for(const width of [300,300.5])for(const zoom of [1,1.25,2,4]){
    const height=240.5,props=constructCanvasProps({...canvasDefaults,shapes:{}}),doc=new Y.Doc();doc.getMap('r').set('p',props);const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
    for(const [i,kind] of ['rect','ellipse','arrow','text','stroke','stroke'].entries())shapes.set(String(i),createShape({id:String(i),kind,x:20+i*12,y:30+i*8,w:80,h:60,fill:'#e2e8f0',opacity:.7,text:'Wrap me',pressureMode:i===5?'variable':'constant',pointArity:i===5?3:2,points:kind==='stroke'?(i===5?[0,0,51,10,20,204,30,5,128]:[0,0,10,20,30,5]):[]}));
    const cached=document.createElement('canvas'),reference=document.createElement('canvas'),mask=document.createElement('canvas'),cache=new CommittedSceneCache(),camera={x:10.25,y:5.5,zoom};
    const compare=(step:string,preview:SceneShape[]=[]):void=>{
      const scene=readCanvas(props).shapes;cache.draw(cached,scene,preview,camera,width,height);paint(reference,[...scene,...preview],camera,width,height);paint(mask,preview,camera,width,height);
      const observed=delta(read(cached),read(reference),preview.length?read(mask):undefined);rows.push({dpr:window.devicePixelRatio,width,height,zoom:camera.zoom,step,phase:preview.length?'gesture':'settled',...observed});
    };
    compare('initial');shapes.get('0')!.set('x',50);compare('move overlapping shape');shapes.get('2')!.set('ord',keyBetween(String(shapes.get('2')!.get('ord')),null));compare('reorder');shapes.delete('1');compare('erase');shapes.get('4')!.set('strokeWidth',8);compare('stroke style');
    const source=readCanvas(props).shapes.find(s=>s.id==='4')!;
    const preview:SceneShape={...source,id:'preview',scalars:{...source.scalars,x:25,y:30,w:1,h:1,basisW:1,basisH:1,opacity:.7},points:[0,0,70,35,120,10]};compare('active translucent stroke',[preview]);
    shapes.set('committed',createShape({...preview.scalars,id:'committed',pointArity:preview.pointArity,points:preview.points,ord:keyBetween(String(source.scalars.ord),null)}));compare('pointerup');
    camera.x+=.25;camera.y+=.5;compare('camera pan');camera.zoom=zoom===4?1:4;compare('camera zoom');
    reference.getContext('2d')!.clearRect(0,0,reference.width,reference.height);negativeControl=Math.max(negativeControl,delta(read(cached),read(reference)).changedPixels);
  }
  return {standard:'Settled: every RGBA byte equal. Gesture: every RGBA byte outside independent active-stroke alpha mask equal.',rows,negativeControl:{description:'Deliberately clear the reference surface',changedPixels:negativeControl},pass:rows.every(row=>row.phase==='settled'?row.changedPixels===0:row.outsideActivePixels===0)&&negativeControl>0};
}
