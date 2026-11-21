import {openHarness} from './openHarness.mjs';
// Native numeric/DOM measurements only. Captures belong to the manager.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));const {chromium}=require('@playwright/test');
const output=new URL('../../../../_evidence-build5/browser.json',import.meta.url),result={scope:'Single-process Chromium, DPR1, 1280x900; 736px editor column. Numeric DOM/CLS; no saved screenshots, no physical-input certification.',layout:null,continuity:[],remote:[]};
const runOutput=new URL(`../../../../_evidence-build5/browser-${Date.now()}.json`,import.meta.url);
const save=()=>{const text=JSON.stringify(result,null,2);writeFileSync(output,text);writeFileSync(runOutput,text);};
let browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try{
 let page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});await openHarness(page);await page.getByRole('region').waitFor();await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>{window.canvasEvidence.column(736);});
 const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const select=async()=>{await page.evaluate(()=>window.canvasEvidence.reset(0));await settle();await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('r');await page.keyboard.press('Enter');};
 await select();
 result.layout=await page.evaluate(()=>{const root=document.querySelector('.ob-canvas'),strip=root.querySelector('.ob-canvas-properties'),controls=[...strip.querySelectorAll('label,button,.ob-canvas-color')].filter(e=>!e.closest('.ob-canvas-color')||e.matches('.ob-canvas-color'));return {column:root.getBoundingClientRect().width,stripHeight:strip.getBoundingClientRect().height,rows:[...new Set(controls.map(e=>Math.round(e.getBoundingClientRect().top+e.getBoundingClientRect().height/2)))],controls:controls.map(e=>({name:e.getAttribute('aria-label')||e.textContent,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width})),footerBottom:root.querySelector('.ob-canvas-footer').getBoundingClientRect().bottom};});save();
 if(result.layout.column!==736||result.layout.stripHeight!==80||result.layout.rows.length!==2)throw new Error('736px two-row contract failed');
 await page.evaluate(()=>{document.body.style.minHeight='2000px';window.scrollTo(0,180);});
 for(const zoom of [100,200,400]){
  await page.getByLabel('Zoom percentage',{exact:true}).fill(String(zoom));await page.getByLabel('Drawing viewport',{exact:true}).focus();
  const measure=()=>page.evaluate(()=>{const v=document.querySelector('.ob-canvas-viewport').getBoundingClientRect(),b=document.querySelector('.ob-canvas-outline').getBoundingClientRect();return {x:b.x-v.x,y:b.y-v.y,w:b.width,h:b.height,scroll:document.scrollingElement.scrollTop,zoom:document.querySelector('[aria-label="Zoom percentage"]').value,focused:document.activeElement.getAttribute('aria-label')};});
  const before=await measure();const driftControl=await page.evaluate(()=>{const el=document.querySelector('.ob-canvas-outline'),before=el.getBoundingClientRect().x;el.style.marginLeft='1px';const delta=el.getBoundingClientRect().x-before;el.style.marginLeft='';return delta;});if(driftControl!==1)throw new Error('Drift control did not fire');for(let i=0;i<5;i++){await page.keyboard.press('f');await settle();await page.getByRole('button',{name:'Back',exact:true}).click();await settle();}
  const after=await measure();result.continuity.push({zoom,cycles:5,before,after,driftControl,reload:await page.evaluate(()=>window.canvasEvidence.reload())});save();if(JSON.stringify(before)!==JSON.stringify(after)||!result.continuity.at(-1).reload)throw new Error('Expansion continuity failed');
 }
 result.continuityScope='DOM continuity with nonzero scroll, not a CLS claim; expansion/scroll inputs may be excluded by CLS recent-input semantics.';
 await browser.close();browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});await openHarness(page);await page.getByRole('region').waitFor();await page.evaluate(()=>{window.canvasEvidence.column(736);window.lastMeasurementInput=performance.now();for(const type of ['keydown','pointerdown','scroll'])window.addEventListener(type,()=>window.lastMeasurementInput=performance.now(),true);});await page.evaluate(()=>document.fonts.ready);
 for(const change of ['join','move','leave','delete','quarantine']){
  await select();if(change==='move'||change==='leave')await page.evaluate(()=>window.canvasEvidence.presence('join'));
  await page.waitForTimeout(700);
  const row=await page.evaluate(async change=>{
   const settle=()=>new Promise(resolve=>setTimeout(resolve,120));let entries=[];const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'layout-shift',buffered:false});const below=()=>document.getElementById('below').getBoundingClientRect().top,before=below(),inputAge=performance.now()-window.lastMeasurementInput,column=document.querySelector('.ob-canvas').getBoundingClientRect().width;if(column!==736)throw new Error('CLS column is not 736');
   if(change==='delete'||change==='quarantine')window.canvasEvidence.remoteChromeChange(change);else window.canvasEvidence.presence(change);
   await settle();const cls=entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0),after=below(),peerCount=document.querySelectorAll('.ob-canvas-peer').length;
   let slot=document.querySelector('.ob-canvas');const main=document.querySelector('main');while(slot.parentElement!==main)slot=slot.parentElement;
   const control=document.createElement('div');main.insertBefore(control,slot);await settle();entries=[];const controlBefore={scroll:document.scrollingElement.scrollTop,below:below(),inputAge:performance.now()-window.lastMeasurementInput};control.append(document.createElement('canvas'));await settle();const controlAfter={scroll:document.scrollingElement.scrollTop,below:below()},controlEntries=entries.map(e=>({value:e.value,hadRecentInput:e.hadRecentInput})),negativeControl=entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0);observer.disconnect();control.remove();return {change,column,inputAge,before,after,cls,negativeControl,controlBefore,controlAfter,controlEntries,peerCount,reload:window.canvasEvidence.reload()};
  },change);result.remote.push(row);save();if(row.inputAge<600||row.controlBefore.inputAge<600||row.cls!==0||row.negativeControl<=0||row.before!==row.after||!row.reload)throw new Error('Remote layout contract failed');
 }
 await select();await page.evaluate(()=>{document.body.style.minHeight='2000px';window.scrollTo(0,124);});await page.waitForTimeout(800);
 result.scrolledControlProbe=await page.evaluate(async()=>{
  let entries=[];const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'layout-shift',buffered:false});const read=()=>({scroll:document.scrollingElement.scrollTop,below:document.getElementById('below').getBoundingClientRect().top,inputAge:performance.now()-window.lastMeasurementInput});let slot=document.querySelector('.ob-canvas');while(slot.parentElement!==document.querySelector('main'))slot=slot.parentElement;const control=document.createElement('div');slot.before(control);await new Promise(r=>setTimeout(r,120));entries=[];const before=read();control.append(document.createElement('canvas'));await new Promise(r=>setTimeout(r,120));const after=read();observer.disconnect();control.remove();return {before,after,controlHeight:150,entries:entries.map(e=>({value:e.value,hadRecentInput:e.hadRecentInput}))};
 });save();
 result.provenance=[];for(const path of ['src/blockeditor/canvas/CanvasBlock.tsx','src/blockeditor/canvas/CanvasPresence.tsx','src/blockeditor/canvas/canvas.css','scripts/canvas-measure/harness.tsx']){const file=new URL('../../'+path,import.meta.url),source=readFileSync(file),served=await (await page.request.get('http://127.0.0.1:5184/'+path)).text();result.provenance.push({path,mtime:statSync(file).mtime.toISOString(),sourceBytes:source.length,sourceSha256:createHash('sha256').update(source).digest('hex'),servedSha256:createHash('sha256').update(served).digest('hex')});}
 save();console.log(JSON.stringify(result,null,2));
}catch(error){result.failure=String(error);save();throw error;}finally{await browser.close();}
