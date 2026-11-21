/** Synthetic representative geometries, not human/device performance evidence. */
import * as Y from 'yjs';
import {writeFileSync} from 'node:fs';
import {createDoc,encodeSnapshot,decodeSnapshot,findBlock,registerPropsConstructor,registerPropsProjection} from '../src/blockeditor/model';
import {canvasDefaults,constructCanvasProps,projectCanvas,readCanvas} from '../src/blockeditor/canvas/schema';
import {CanvasHistory} from '../src/blockeditor/canvas/history';
import {insertShapes,eraseShapes} from '../src/blockeditor/canvas/commands';
import {simplifyStroke} from '../src/blockeditor/canvas/decimation';
registerPropsConstructor('canvas',constructCanvasProps);registerPropsProjection('canvas',projectCanvas);
const fixtures=[
  {name:'straight',n:500,point:(i:number)=>[i/4,i/8]},
  {name:'arc',n:600,point:(i:number)=>[100*Math.cos(i/600*Math.PI),100*Math.sin(i/600*Math.PI)]},
  {name:'handwriting-like',n:800,point:(i:number)=>[i/4,Math.sin(i/18)*8+Math.sin(i/51)*12]},
  {name:'loops',n:1000,point:(i:number)=>[i/20+Math.sin(i/25)*20,Math.cos(i/25)*20]},
  {name:'corner-stress',n:1200,point:(i:number)=>[i/4,i%2?3:0]},
];
const samples=fixtures.flatMap(f=>[2,3].map(arity=>{const points=Array.from({length:f.n},(_,i)=>[...f.point(i),...(arity===3?[Math.round(128+80*Math.sin(i/35))]:[])]).flat();return {name:f.name,arity:arity as 2|3,points,result:simplifyStroke(points,arity as 2|3)};}));
const representative=['smooth-curve','handwriting-like','loop'].flatMap(name=>[0,1,2,3,4].flatMap(variant=>[2,3].map(arity=>{
  const n=160+variant*40;
  const points=Array.from({length:n},(_,i)=>{const t=i/(n-1);const xy=name==='smooth-curve'?[100*t,30*Math.sin(t*Math.PI)]:name==='handwriting-like'?[100*t,12*Math.sin(t*6*Math.PI)+4*Math.sin(t*2*Math.PI)]:[60*t+20*Math.sin(t*4*Math.PI),20*Math.cos(t*4*Math.PI)];return [...xy,...(arity===3?[Math.round(128+80*Math.sin(t*2*Math.PI))]:[])];}).flat();
  return {name,variant,arity:arity as 2|3,points,result:simplifyStroke(points,arity as 2|3)};
})));
// Independent chronological segment check against original points; indices are
// recovered by exact retained tuple identity, not simplifier internals.
function deviation(original:number[],retained:number[],arity:2|3){
  let originalIndex=0,maxGeometry=0,maxPressureQ=0;
  for(let end=arity;end<retained.length;end+=arity){
    let next=originalIndex+1;
    while(next<original.length/arity&&!retained.slice(end,end+arity).every((value,k)=>value===original[next*arity+k]))next++;
    if(next===original.length/arity)throw new Error('Retained tuple lost q or order');
    const dx=retained[end]-retained[end-arity],dy=retained[end+1]-retained[end-arity+1],length=dx*dx+dy*dy;
    for(let i=originalIndex;i<=next;i++){const x=original[i*arity]-retained[end-arity],y=original[i*arity+1]-retained[end-arity+1],t=length?Math.max(0,Math.min(1,(x*dx+y*dy)/length)):(i-originalIndex)/(next-originalIndex);maxGeometry=Math.max(maxGeometry,Math.hypot(x-t*dx,y-t*dy));if(arity===3)maxPressureQ=Math.max(maxPressureQ,Math.abs(original[i*arity+2]-retained[end-arity+2]-t*(retained[end+2]-retained[end-arity+2])));}
    originalIndex=next;
  }
  return {maxGeometry,maxPressureQ};
}
const checks=[...samples,...representative].map(s=>({name:s.name,arity:s.arity,...deviation(s.points,s.result.points,s.arity)}));
if(checks.some(c=>c.maxGeometry>.500000001||c.maxPressureQ>1.000000001))throw new Error('Fidelity bound exceeded');
const control=representative.find(s=>s.arity===3)!;
const negativeControl=deviation(control.points,[...control.points.slice(0,3),...control.points.slice(-3)],3);
if(negativeControl.maxGeometry<=.5||negativeControl.maxPressureQ<=1)throw new Error('Deviation meter control failed');
const bytes=(doc:Y.Doc)=>{const snapshot=encodeSnapshot(doc);const raw=Y.encodeStateAsUpdate(doc).length;return {raw,base64:Buffer.byteLength(snapshot.update),projection:Buffer.byteLength(JSON.stringify(snapshot.blocks)),complete:Buffer.byteLength(JSON.stringify(snapshot))};};
const boards=[];
for(const count of [100,500]) for(let trial=0;trial<5;trial++) for(const simplified of [false,true]){
  const doc=createDoc([{id:'canvas',type:'canvas',props:{...canvasDefaults,shapes:{}}}]);doc.clientID=101+trial;const history=new CanvasHistory(doc),ids:string[]=[];let updateBytes=0;doc.on('update',(update:Uint8Array)=>updateBytes+=update.length);
  for(let i=0;i<count;i++){const sample=samples[(i+trial*2)%samples.length];ids.push(...insertShapes(history,'canvas',[{kind:'stroke',x:i%25*120,y:Math.floor(i/25)*100,pressureMode:sample.arity===3?'variable':'constant',pointArity:sample.arity,points:simplified?sample.result.points:sample.points}],'Stroke'));}
  const before=bytes(doc);eraseShapes(history,'canvas',ids.filter((_,i)=>i%2===0));const retainedUndo=bytes(doc);const snapshot=encodeSnapshot(doc),fresh=decodeSnapshot(snapshot),afterReload=bytes(fresh);
  const scene=JSON.stringify(readCanvas(findBlock(doc,'canvas')!.block.get('props'))),reloadEqual=scene===JSON.stringify(readCanvas(findBlock(fresh,'canvas')!.block.get('props')));if(!reloadEqual)throw new Error('Reload differs');
  boards.push({count,trial,simplified,updateBytes,before,afterHalfEraseRetainedUndo:retainedUndo,afterReload,reloadEqual});history.destroy();doc.destroy();fresh.destroy();
}
const distribution=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return {median:v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2,worst:Math.max(...v)};};
const summary=[100,500].flatMap(count=>[false,true].map(simplified=>{const rows=boards.filter(r=>r.count===count&&r.simplified===simplified);return {count,simplified,base64:distribution(rows.map(r=>r.before.base64)),complete:distribution(rows.map(r=>r.before.complete)),retainedUndoBase64:distribution(rows.map(r=>r.afterHalfEraseRetainedUndo.base64)),retainedUndoComplete:distribution(rows.map(r=>r.afterHalfEraseRetainedUndo.complete))};}));
const classes=[['original-synthetic',samples],['representative-geometric-proxies',representative]] as const;
const perClass=classes.flatMap(([population,rows])=>[...new Set(rows.map(s=>s.name))].flatMap(name=>[2,3].map(arity=>({population,name,arity,count:rows.filter(s=>s.name===name&&s.arity===arity).length,retained:distribution(rows.filter(s=>s.name===name&&s.arity===arity).map(s=>s.result.retained))}))));
writeFileSync('../../_evidence-build5/decimation.json',JSON.stringify({generation:{original:'straight: (i/4,i/8), n500; arc: (100 cos(i*pi/600),100 sin(i*pi/600)), n600; handwriting-like: (i/4,8 sin(i/18)+12 sin(i/51)), n800; loops: (i/20+20 sin(i/25),20 cos(i/25)), n1000; corner-stress: (i/4,3*(i mod 2)), n1200. Variable q=round(128+80 sin(i/35)).',representative:'Geometric proxies, NOT recorded human handwriting. Five sample densities n=160,200,240,280,320 per class; t=i/(n-1). Smooth=(100t,30 sin(pi*t)); handwriting-like=(100t,12 sin(6pi*t)+4 sin(2pi*t)); loop=(60t+20 sin(4pi*t),20 cos(4pi*t)). Variable q=round(128+80 sin(2pi*t)). Both constant and variable modes.'},perClass,checks,negativeControl,scope:'Five synthetic geometry families, constant/variable q; five mixed boards at each 100/500 stroke size, random production shape ids; whole pointerup transactions with semantic history, then half erase and fresh reload. UTF-8 bytes, uncompressed. Observed worst is not a hard cap. No prediction or time-flushed streaming implemented.',strokes:samples.map(s=>({name:s.name,arity:s.arity,original:s.result.original,retained:s.result.retained,overrun:s.result.overrun})),retained:distribution(samples.map(s=>s.result.retained)),summary,boards},null,2));
console.log(JSON.stringify({perClass,checks,negativeControl,retained:distribution(samples.map(s=>s.result.retained)),summary},null,2));
