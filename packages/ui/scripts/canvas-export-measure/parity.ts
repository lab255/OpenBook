import * as Y from 'yjs';
import {canvasDefaults,constructCanvasProps,createShape,readCanvas,projectCanvas} from '../../src/blockeditor/canvas/schema';
import {paint} from '../../src/blockeditor/canvas/geometry';
import {paintViewer} from '../../src/viewer/canvasPaint';
import {readViewerCanvas} from '../../src/viewer/canvasScene';

function run(expectedDpr:number) {
  if(window.devicePixelRatio!==expectedDpr)throw new Error('Wrong DPR');
  const rows=[];
  const read=(c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;
  const difference=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>{
    if(a.length!==b.length)throw new Error('Mismatched pixel dimensions');
    let channels=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])channels++;return channels;
  };
  for(const width of [300,300.5])for(const zoom of [.5,1,1.25,2,4])for(const font of ['sans','serif','mono'])for(const dashed of [false,true]) {
    const doc=new Y.Doc(),props=constructCanvasProps({...canvasDefaults,shapes:{}});doc.getMap('root').set('p',props);
    const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
    for(const [i,kind] of ['rect','ellipse','arrow','text','stroke','stroke','stroke'].entries())shapes.set(String(i),createShape({
      id:String(i),kind,x:10+i*15,y:15+i*10,w:80,h:60,basisW:80,basisH:60,fill:'#e2e8f0',opacity:.7,
      text:'Wrap me\n字 eye',fontFamily:font,textAlign:['left','center','right'][i%3],startHead:'arrow',
      dash:dashed?'dashed':'solid',strokeWidth:3.5,pressureMode:i===5?'variable':'constant',pointArity:i===5?3:2,
      points:kind==='stroke'?(i===5?[0,0,0,10,20,255,30,5,80,60,40,200]:i===6?[8,8]:[0,0,10,20,30,5,60,40]):[],
    }));
    const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));
    const expected=readCanvas(props).shapes,actual=readViewerCanvas(projectCanvas(fresh.getMap('root').get('p') as Y.Map<unknown>)).shapes;
    if(expected.length!==7||actual.length!==7)throw new Error('Incomplete scene');
    const a=document.createElement('canvas'),b=document.createElement('canvas'),camera={x:10.25,y:5.5,zoom},height=240.5;
    paint(a,expected,camera,width,height);paintViewer(b,actual,camera,width,height);
    if(a.width!==Math.round(width*expectedDpr)||a.height!==Math.round(height*expectedDpr))throw new Error('Wrong raster dimensions');
    const changedChannels=difference(read(a),read(b));
    b.getContext('2d')!.clearRect(0,0,b.width,b.height);
    const controlChangedChannels=difference(read(a),read(b));
    if(changedChannels||!controlChangedChannels)throw new Error(`Parity ${changedChannels}, control ${controlChangedChannels}`);
    rows.push({width,height,zoom,font,dashed,changedChannels,controlChangedChannels});
  }
  return {dpr:expectedDpr,scope:'Exact RGBA-channel equality: app committed painter vs viewer mirror, all five kinds, pressure extremes, fractional sizes, clipping, fonts, fresh Yjs import. Raster availability, not physical display presentation.',rows};
}
Object.assign(window,{runCanvasExportParity:run});
