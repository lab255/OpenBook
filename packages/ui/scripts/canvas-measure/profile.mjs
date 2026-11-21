import {openHarness} from './openHarness.mjs';
// Bounded CPU/call-count diagnosis, not a latency benchmark or visual capture.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const output=name=>fileURLToPath(new URL(`../../../../_evidence-build4/${name}`,import.meta.url));
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 await openHarness(page);await page.getByRole('region').waitFor();
 await page.evaluate(()=>window.canvasEvidence.reset(500));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('p');
 await page.evaluate(()=>{
  window.profileEvents=[];window.paintCounts={stroke:0,clearRect:0,drawImage:0};
  for(const name of Object.keys(window.paintCounts)){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){window.paintCounts[name]++;return original.apply(this,args);};}
  for(const type of ['pointerdown','pointermove','pointerup']){
   document.addEventListener(type,()=>{const before={...window.paintCounts},started=performance.now();queueMicrotask(()=>window.profileEvents.push({type,ms:performance.now()-started,...Object.fromEntries(Object.keys(window.paintCounts).map(key=>[key,window.paintCounts[key]-before[key]]))}));},true);
  }
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:500});await cdp.send('Profiler.start');
 const v=await page.getByLabel('Drawing viewport').boundingBox();
 const inputCounts=[];
 const count=async(type,operation)=>{const before=await page.evaluate(()=>window.paintCounts);await operation();const after=await page.evaluate(()=>window.paintCounts);inputCounts.push({type,...Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]))});};
 for(let i=0;i<12;i++){await page.mouse.move(v.x+40+i*18,v.y+350);await count('down',()=>page.mouse.down());await count('move (3 real delivered steps)',()=>page.mouse.move(v.x+45+i*18,v.y+345,{steps:3}));await count('up',()=>page.mouse.up());}
 const {profile}=await cdp.send('Profiler.stop');writeFileSync(output('dense-before.cpuprofile'),JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n]));const totals=new Map();
 for(let i=0;i<(profile.samples??[]).length;i++){const frame=nodes.get(profile.samples[i]).callFrame,key=`${frame.functionName} ${frame.url}:${frame.lineNumber+1}`;totals.set(key,(totals.get(key)??0)+(profile.timeDeltas?.[i]??500));}
 const events=await page.evaluate(()=>window.profileEvents);
 const opacity=await page.evaluate(async()=>{
  const button=document.querySelector('.ob-canvas button');const inspect=()=>({inline:button.style.color,computed:getComputedStyle(button).color,opacity:getComputedStyle(button).opacity,transition:getComputedStyle(button).transition,children:[...button.childNodes].map(n=>({type:n.nodeType,text:n.textContent})),parsed:getComputedStyle(button).color.match(/[\d.]+/g)?.map(Number)});
  const before=inspect();button.style.transitionDuration='123ms';button.style.color='rgba(0,0,0,.4)';const immediate=inspect();await new Promise(r=>setTimeout(r,200));return {before,immediate,settled:inspect()};
 });
 const summary={inputCounts,label:'Diagnostic instrumented run; counts and CPU samples, not acceptance latency',events,hotSelfSamplesMicroseconds:[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,35),opacity};
 writeFileSync(output('diagnosis.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));
}finally{await browser.close();}
