// Numeric evidence only: net-origin remote chrome changes and stored paper color.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const output=fileURLToPath(new URL('../../../../_evidence-build4/remote-chrome.json',import.meta.url));
const result={method:'Native Chromium, DPR1; actual peer Yjs update delivered through production remoteFrameQueue(doc, net). Observe after 700ms without local input. No screenshots or presentation claim.',rows:[]};
const save=()=>writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:1100},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');await page.getByRole('region').waitFor();await page.evaluate(()=>document.fonts.ready);
 for(const change of ['delete','quarantine']){
  await page.evaluate(()=>window.canvasEvidence.reset(0));await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('r');await page.keyboard.press('Enter');
  if(change==='delete')await page.getByRole('button',{name:'Arrange',exact:true}).click();
  else await page.getByLabel('Width',{exact:true}).focus();
  await page.waitForTimeout(700);
  const row=await page.evaluate(async change=>{
   const settle=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,80)));
   const inspect=()=>{const root=document.querySelector('.ob-canvas'),strip=root.querySelector('.ob-canvas-properties');return {height:root.getBoundingClientRect().height,viewport:root.querySelector('.ob-canvas-viewport').getBoundingClientRect().toJSON(),stripHeight:strip?.getBoundingClientRect().height??null,stripVisibility:strip?getComputedStyle(strip).visibility:'missing',footerTop:root.querySelector('.ob-canvas-footer')?.getBoundingClientRect().top??null,belowTop:document.getElementById('below').getBoundingClientRect().top,focus:document.activeElement===document.body?'body':document.activeElement.getAttribute('aria-label')||document.activeElement.textContent,fieldInert:!!strip?.inert,announcement:root.querySelector('.ob-canvas-live').textContent,shapes:window.canvasEvidence.scene().shapes.length,editable:window.canvasEvidence.scene().editable};};
   const before=inspect(),focusEvents=[];const describe=el=>el===document.body?'body':el?.getAttribute?.('aria-label')||el?.getAttribute?.('role')||el?.tagName||null;const trace=e=>focusEvents.push({type:e.type,target:describe(e.target),related:describe(e.relatedTarget),active:describe(document.activeElement)});for(const type of ['focus','blur','focusin','focusout'])document.addEventListener(type,trace,true);let entries=[];const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'layout-shift',buffered:false});
   const delivery=window.canvasEvidence.remoteChromeChange(change);await settle();await settle();const after=inspect(),agreement=window.canvasEvidence.providerAgreement();const hiddenField=document.querySelector('.ob-canvas-properties input[aria-label="Width"]');hiddenField?.focus();const hiddenFieldTookFocus=document.activeElement===hiddenField;const hiddenFieldDisabled=hiddenField?.matches(':disabled');
   const shifts=entries.map(e=>({value:e.value,hadRecentInput:e.hadRecentInput,sources:e.sources.map(s=>({tag:s.node?.tagName,className:s.node?.className,text:s.node?.textContent?.slice(0,60),previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))}));
   const cls=entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0);
   const holder=document.createElement('div');document.querySelector('main').insertBefore(holder,document.querySelector('.ob-canvas'));await settle();entries=[];holder.appendChild(document.createElement('canvas'));await settle();const negativeControl=entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0);observer.disconnect();holder.remove();
   for(const type of ['focus','blur','focusin','focusout'])document.removeEventListener(type,trace,true);return {change,delivery,before,after,agreement,cls,shifts,negativeControl,focusEvents,hiddenFieldTookFocus,hiddenFieldDisabled};
  },change);
  result.rows.push(row);save();
  if(row.cls!==0||row.negativeControl<=0||!row.agreement.live||!row.agreement.fresh||row.delivery.bytes<=0||row.delivery.origin!=='net'||row.after.stripVisibility!=='hidden'||!row.after.fieldInert||row.hiddenFieldTookFocus||!row.hiddenFieldDisabled||change==='quarantine'&&(!row.after.focus.startsWith('Canvas,')||row.after.announcement!=='View only')||row.before.height!==row.after.height||row.before.stripHeight!==row.after.stripHeight||row.before.footerTop!==row.after.footerTop||row.before.belowTop!==row.after.belowTop||change==='delete'&&row.after.focus!=='Arrange')throw new Error('Remote chrome contract failed; inspect remote-chrome.json');
 }
 await page.evaluate(()=>{window.canvasEvidence.reset(0);document.documentElement.classList.add('dark');});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>window.canvasEvidence.background('#f5e4c3'));await page.getByRole('region').focus();await page.keyboard.press('Enter');
 result.paper=await page.evaluate(()=>{const v=document.querySelector('.ob-canvas-viewport'),hint=document.querySelector('.ob-canvas-empty');const before={paper:getComputedStyle(v).backgroundColor,hint:getComputedStyle(hint).backgroundColor};hint.style.backgroundColor='red';const negativeControl=getComputedStyle(hint).backgroundColor;hint.style.backgroundColor='';return {before,negativeControl};});
 const v=await page.getByLabel('Drawing viewport').boundingBox();await page.mouse.move(v.x+40,v.y+40);await page.mouse.down();
 result.paper.during=await page.evaluate(()=>({paper:getComputedStyle(document.querySelector('.ob-canvas-viewport')).backgroundColor,hintPresent:!!document.querySelector('.ob-canvas-empty')}));await page.mouse.up();save();
 if(result.paper.before.paper!==result.paper.during.paper||result.paper.before.paper!=='rgb(245, 228, 195)'||result.paper.before.hint!=='rgba(0, 0, 0, 0)'||result.paper.negativeControl!=='rgb(255, 0, 0)'||result.paper.during.hintPresent)throw new Error('Stored paper background hidden');
 console.log(JSON.stringify(result,null,2));
} catch(error){result.failure=String(error);save();throw error;} finally {await browser.close();}
