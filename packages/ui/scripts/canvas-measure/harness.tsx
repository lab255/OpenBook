import {keyBetween} from '@book.dev/sdk';
import {createRoot} from 'react-dom/client';
import {useState} from 'react';
import * as Y from 'yjs';
import {createDoc, findBlock, rootBlocks} from '../../src/blockeditor/model';
import {registerReactiveBlocks} from '../../src/blockeditor/reactiveBlocks';
import {BlockEditor} from '../../src/blockeditor/BlockEditor';
import {CanvasHistory} from '../../src/blockeditor/canvas/history';
import {CanvasBlock} from '../../src/blockeditor/canvas/CanvasBlock';
import {canvasDefaults, constructCanvasProps, createShape, readCanvas} from '../../src/blockeditor/canvas/schema';
import {useBlockEditor} from '../../src/blockeditor/useBlockEditor';
import {registerBlockEditorDoc} from '../../src/lib/aiBridge';
import {setPageSaveStatus} from '../../src/lib/pageSaveStatus';
import '../../src/index.css';
import {remoteFrameQueue} from '../../src/blockeditor/remoteFrame';
import {bufferedProviders} from './bufferedTransport';
import {CommittedSceneCache} from '../../src/blockeditor/canvas/paintCache';
import {paint} from '../../src/blockeditor/canvas/geometry';
registerReactiveBlocks();
let doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}]);
let peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));
let remount:()=>void;
let editorMode=false;
let netQueue:ReturnType<typeof remoteFrameQueue>|null=null;
let transport:ReturnType<typeof bufferedProviders>|null=null;
function App(){const [version,setVersion]=useState(0);remount=()=>setVersion(n=>n+1);return <Surface key={version}/>;}
function CanvasSurface(){const editor=useBlockEditor(doc);return <CanvasBlock block={rootBlocks(doc).get(0)} editor={editor} pageReadOnly={false}/>;}
function Surface(){return <main style={{width:800,margin:'40px auto'}}><h1>Canvas local measurement harness</h1><p>All generated input is synthetic/local. No physical latency or hardware certification.</p><>{editorMode?<BlockEditor doc={doc}/>:<CanvasSurface/>}</><p id="below">Text after the canvas detects unexpected layout movement.</p></main>;}
registerBlockEditorDoc('canvas-evidence',doc);
const api={
  resetEditor(){netQueue?.close();netQueue=null;transport?.close();transport=null;editorMode=true;doc=createDoc([{id:'entry',type:'paragraph'}]);remount();},
  editorBlocks(){return rootBlocks(doc).toArray().map(block=>({id:String(block.get('id')),type:String(block.get('type'))}));},
  reset(count=0){editorMode=false;netQueue?.close();netQueue=null;transport?.close();transport=null;doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}]);const props=findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>,shapes=props.get('shapes') as Y.Map<unknown>;
    for(let i=0;i<count;i++)shapes.set(`s${i}`,createShape({id:`s${i}`,kind:'stroke',x:i%25*24,y:Math.floor(i/25)*12,w:1,h:1,points:Array.from({length:50},(_,j)=>[j/2,Math.sin(j/4)*5]).flat()}));
    peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));registerBlockEditorDoc('canvas-evidence',doc);remount();},
  remote(){const props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;let shape=shapes.get('remote');if(!shape){shapes.set('remote',createShape({id:'remote',kind:'rect',x:20,y:20,w:30,h:30}));shape=shapes.get('remote')!;}shape.set('x',Number(shape.get('x'))+1);Y.applyUpdate(doc,Y.encodeStateAsUpdate(peer));},
  remoteChromeChange(change:'delete'|'quarantine'){
    Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));const vector=Y.encodeStateVector(doc),props=findBlock(peer,'canvas')!.block.get('props') as Y.Map<unknown>;
    peer.transact(()=>{if(change==='delete'){const shapes=props.get('shapes') as Y.Map<unknown>;shapes.delete([...shapes.keys()][0]);}else props.set('canvasVersion',2);},'local');
    const packet=Y.encodeStateAsUpdate(peer,vector);netQueue??=remoteFrameQueue(doc,'net');netQueue.receive(packet);return {origin:'net',bytes:packet.byteLength};
  },
  background(color:string){(findBlock(doc,'canvas')!.block.get('props') as Y.Map<unknown>).set('background',color);},
  startProviders(){transport?.close();peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));transport=bufferedProviders(doc,peer);},
  outage(){transport!.outage();},
  outageEdit(singleTransaction=false){
    const target=readCanvas(findBlock(peer,'canvas')!.block.get('props')).shapes[0],history=new CanvasHistory(peer);
    const transactions:{x:unknown;stroke:unknown;bytes:number}[]=[];
    const record=(update:Uint8Array,origin:unknown)=>{if(origin==='local'){const shape=readCanvas(findBlock(peer,'canvas')!.block.get('props')).shapes[0];transactions.push({x:shape.scalars.x,stroke:shape.scalars.stroke,bytes:update.byteLength});}};
    peer.on('update',record);
    if(singleTransaction)history.commitCanvasCommand('Move and style',[{blockId:'canvas',shapeId:target.id,values:{x:Number(target.scalars.x)+8,stroke:'#b91c1c'}}]);
    else {history.commitCanvasCommand('Move',[{blockId:'canvas',shapeId:target.id,values:{x:Number(target.scalars.x)+8}}]);history.commitCanvasCommand('Style',[{blockId:'canvas',shapeId:target.id,values:{stroke:'#b91c1c'}}]);}
    peer.off('update',record);history.destroy();return transactions;
  },
  transportState(){return transport!.state();},
  reconnect(){return transport!.reconnect();},
  providerAgreement(){const local=JSON.stringify(readCanvas(findBlock(doc,'canvas')!.block.get('props'))),remote=JSON.stringify(readCanvas(findBlock(peer,'canvas')!.block.get('props')));const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));return {live:local===remote,fresh:local===JSON.stringify(readCanvas(findBlock(fresh,'canvas')!.block.get('props')))};},
  cacheFidelity(){
    const props=constructCanvasProps({...canvasDefaults,shapes:{}}),d=new Y.Doc();d.getMap('r').set('p',props);const shapes=props.get('shapes') as Y.Map<Y.Map<unknown>>;
    for(const [i,kind] of ['rect','ellipse','arrow','text','stroke'].entries())shapes.set(String(i),createShape({id:String(i),kind,x:20+i*12,y:30+i*8,w:80,h:60,fill:'#e2e8f0',opacity:.7,text:'Wrap me',points:kind==='stroke'?[0,0,10,20,30,5]:[]}));
    const cached=document.createElement('canvas'),reference=document.createElement('canvas'),cache=new CommittedSceneCache(),camera={x:10,y:5,zoom:1.25};const rows=[];
    const compare=(step:string)=>{const scene=readCanvas(props).shapes;cache.draw(cached,scene,[],camera,300,240);paint(reference,scene,camera,300,240);const a=cached.getContext('2d')!.getImageData(0,0,300,240).data,b=reference.getContext('2d')!.getImageData(0,0,300,240).data;let maxChannelDelta=0;for(let i=0;i<a.length;i++)maxChannelDelta=Math.max(maxChannelDelta,Math.abs(a[i]-b[i]));rows.push({step,maxChannelDelta});};
    compare('initial');shapes.get('0')!.set('x',50);compare('move overlapping shape');shapes.get('2')!.set('ord',keyBetween(String(shapes.get('2')!.get('ord')),null));compare('reorder');shapes.delete('1');compare('erase');camera.zoom=2;compare('zoom invalidation');shapes.get('4')!.set('strokeWidth',8);compare('stroke style');
   reference.getContext('2d')!.clearRect(0,0,300,240);const a=cached.getContext('2d')!.getImageData(0,0,300,240).data,b=reference.getContext('2d')!.getImageData(0,0,300,240).data;let negativeControl=0;for(let i=0;i<a.length;i++)negativeControl=Math.max(negativeControl,Math.abs(a[i]-b[i]));return {rows,negativeControl};
  },
  status(value:'idle'|'saving'|'saved'|'save failed'){setPageSaveStatus('canvas-evidence',value);},
  reload(){const fresh=new Y.Doc();Y.applyUpdate(fresh,Y.encodeStateAsUpdate(doc));return JSON.stringify(readCanvas(findBlock(fresh,'canvas')!.block.get('props')))===JSON.stringify(readCanvas(findBlock(doc,'canvas')!.block.get('props')));},
  scene(){return readCanvas(findBlock(doc,'canvas')!.block.get('props'));},
};
Object.assign(window,{canvasEvidence:api});createRoot(document.getElementById('root')!).render(<App/>);
