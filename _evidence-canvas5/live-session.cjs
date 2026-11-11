// Reproducible synthetic-input capture of REAL /editor-lab windows and BroadcastChannel.
const {chromium,expect}=require('../packages/web/node_modules/@playwright/test');
const fs=require('node:fs');
const out='_evidence-canvas5';
(async()=>{
 const browser=await chromium.launch({headless:false,args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
 const context=await browser.newContext({viewport:{width:900,height:850},recordVideo:{dir:out+'/raw-video',size:{width:900,height:850}}});
 await context.addInitScript(()=>{
  window.canvas5CLS=0;window.canvas5Shifts=[];
  new PerformanceObserver(list=>{for(const e of list.getEntries()){if(!e.hadRecentInput)window.canvas5CLS+=e.value;window.canvas5Shifts.push({value:e.value,recent:e.hadRecentInput,time:e.startTime});}}).observe({type:'layout-shift',buffered:true});
  const BC=window.BroadcastChannel;window.canvas5Hold=false;window.canvas5Queue=[];
  window.BroadcastChannel=class extends BC{postMessage(m){if(window.canvas5Hold && m.type==='update')window.canvas5Queue.push(()=>super.postMessage(m));else super.postMessage(m);}};
  window.canvas5Flush=()=>{window.canvas5Hold=false;const q=window.canvas5Queue.splice(0);q.forEach(send=>send());return q.length;};
 });
 const a=await context.newPage(); const errors=[];a.on('pageerror',e=>errors.push(e.message));
 await a.goto('http://127.0.0.1:3105/editor-lab');await a.waitForSelector('[data-canvas-surface]',{timeout:120000});
 const cdp=await context.newCDPSession(a); const info=await cdp.send('Target.getTargetInfo'); const contextId=info.targetInfo.browserContextId;
 const newPage=context.waitForEvent('page');await cdp.send('Target.createTarget',{url:'about:blank',newWindow:true,browserContextId:contextId});const b=await newPage;b.on('pageerror',e=>errors.push(e.message));
 const log=[];const stamp=(action,data={})=>log.push({time:Date.now(),action,...data});
 const scene=page=>page.evaluate(()=>{const doc=window.canvas5Doc;const block=doc.getArray('blocks').toArray().find(b=>b.get('type')==='canvas');return {client:doc.clientID,shapes:block.get('props').get('shapes').toJSON()};});
 const surface=page=>page.locator('[data-canvas-surface]');
 const shot=async(name)=>{await a.screenshot({path:`${out}/${name}-a.png`});await b.screenshot({path:`${out}/${name}-b.png`});stamp(name,{a:await scene(a),b:await scene(b)});};
 const converged=async()=>{await expect.poll(async()=>JSON.stringify((await scene(a)).shapes)).toBe(JSON.stringify((await scene(b)).shapes));};
 await a.waitForTimeout(700);await a.evaluate(()=>{window.canvas5CLS=0;window.canvas5Shifts=[];});
 await b.goto('http://127.0.0.1:3105/editor-lab');await b.waitForSelector('[data-canvas-surface]');await a.waitForTimeout(1100);
 await expect(a.locator('[data-peer-count]')).toHaveAttribute('data-peer-count','1');await expect(b.locator('[data-peer-count]')).toHaveAttribute('data-peer-count','1');
 const cls=await a.evaluate(()=>({value:window.canvas5CLS,shifts:window.canvas5Shifts,supported:PerformanceObserver.supportedEntryTypes.includes('layout-shift')}));stamp('join',{cls});await shot('01-joined');
 for(const page of [a,b])await page.evaluate(()=>{window.canvas5Observed=0;window.canvas5Doc.on('afterTransaction',()=>{window.canvas5Observed++;const shapes=window.canvas5Doc.getArray('blocks').toArray().find(b=>b.get('type')==='canvas').get('props').get('shapes');shapes.forEach(s=>{for(const k of ['x','y','w','h'])if(!Number.isFinite(s.get(k)))throw Error('Incomplete geometry '+k);});});});
 async function dispatch(page,type,x,y,extra={}) {await surface(page).evaluate((el,{type,x,y,extra})=>{const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:7,pointerType:'pen',isPrimary:true,buttons:type==='pointerup'?0:1,clientX:r.left+x,clientY:r.top+y,pressure:.5,...extra}));},{type,x,y,extra});}
 // Three warmup strokes followed by twelve retained FIRST-INK fences.
 await a.bringToFront();
 const cadence=await a.evaluate(()=>new Promise(resolve=>{const samples=[];let last;function frame(t){if(last!==undefined)samples.push(t-last);last=t;if(samples.length<20)requestAnimationFrame(frame);else resolve(samples);}requestAnimationFrame(frame);}));
 const samples=[];
 for(let i=0;i<15;i++) {
  await surface(a).focus();await a.keyboard.press('p');const before=await a.evaluate(()=>window.canvas5Samples?.length??0);
  const x=40+(i%5)*115,y=35+Math.floor(i/5)*40;
  await dispatch(a,'pointerdown',x,y,{pressure:.15});await a.waitForTimeout(65);
  const first=await a.evaluate(i=>window.canvas5Samples[i],before);
  for(let j=1;j<=8;j++){await dispatch(a,'pointermove',x+j*8,y+Math.sin(j*.6)*10,{pressure:.15+j*.09});await a.waitForTimeout(12);}
  await dispatch(a,'pointerup',x+64,y-10);if(i>=3)samples.push({...first,stroke:i-2});await a.waitForTimeout(23+(i*7)%31);
 }
 await converged();await shot('02-pressure-ink');stamp('ink',{samples});
 // Keyboard creation + exact nudge, on the same viewport and content.
 await surface(a).focus();await a.keyboard.press('r');await a.keyboard.press('Enter');await a.waitForTimeout(200);
 const initial=await scene(a),rect=Object.values(initial.shapes).find(s=>s.kind==='rect');const id=rect.id;
 await shot('03-keyboard-before');await a.keyboard.press('ArrowRight');await a.keyboard.press('Shift+ArrowDown');await a.waitForTimeout(250);await converged();await shot('04-keyboard-after');
 const nudged=(await scene(a)).shapes[id];expect(nudged.x).toBe(rect.x+1);expect(nudged.y).toBe(rect.y+10);
 // Both windows edit different shapes via their actual UI.
 await surface(b).focus();await b.keyboard.press('a');await b.keyboard.press('Enter');await a.waitForTimeout(250);await converged();await shot('05-both-editing');
 // Start both drags at the same common rectangle; hold outgoing update delivery
 // only across the commit barrier to force genuine concurrent same-field writes.
 for(const p of [a,b]){await surface(p).focus();await p.keyboard.press('s');await p.evaluate(()=>window.canvas5Hold=true);}
 const base=(await scene(a)).shapes[id];
 for(const [p,dx] of [[a,40],[b,80]]){await dispatch(p,'pointerdown',base.x+30,base.y+30,{pointerType:'mouse'});await dispatch(p,'pointermove',base.x+30+dx,base.y+50,{pointerType:'mouse'});await dispatch(p,'pointerup',base.x+30+dx,base.y+50,{pointerType:'mouse'});}
 const premerge={a:await scene(a),b:await scene(b)};expect(premerge.a.shapes[id].x).toBe(base.x+40);expect(premerge.b.shapes[id].x).toBe(base.x+80);stamp('concurrent-local-commits',{premerge});
 const queued=await Promise.all([a.evaluate(()=>window.canvas5Flush()),b.evaluate(()=>window.canvas5Flush())]);await a.waitForTimeout(300);await converged();await shot('06-concurrent-winner');
 const winner=premerge.a.client>premerge.b.client?a:b;const loser=winner===a?b:a;const winning=(await scene(a)).shapes[id];
 await surface(winner).focus();await winner.keyboard.press('Control+z');await a.waitForTimeout(300);await converged();await shot('07-winner-undo');expect((await scene(a)).shapes[id].x).toBe(base.x);
 await winner.keyboard.press('Control+Shift+z');await a.waitForTimeout(300);await converged();await shot('08-winner-redo');expect((await scene(a)).shapes[id].x).toBe(winning.x);
 await surface(loser).focus();await loser.keyboard.press('Control+z');await a.waitForTimeout(300);await converged();await shot('09-loser-noop');expect((await scene(a)).shapes[id].x).toBe(winning.x);
 // Cancellation is local; no new shared shape appears.
 const count=Object.keys((await scene(a)).shapes).length;await surface(a).focus();await a.keyboard.press('p');await dispatch(a,'pointerdown',60,280);await dispatch(a,'pointermove',240,310);await a.keyboard.press('Escape');await dispatch(a,'pointerup',240,310);expect(Object.keys((await scene(a)).shapes).length).toBe(count);await shot('10-cancel');
 const result={synthetic:true,engine:await browser.version(),userAgent:await a.evaluate(()=>navigator.userAgent),viewport:{width:900,height:850},cadence,samples,cls,log,queued,errors,observed:await Promise.all([a.evaluate(()=>window.canvas5Observed),b.evaluate(()=>window.canvas5Observed)]),winner: winner===a?'A':'B'};
 fs.writeFileSync(`${out}/live-results.json`,JSON.stringify(result,null,2));
 const av=a.video(),bv=b.video();await context.close();await av.saveAs(`${out}/live-window-a.webm`);await bv.saveAs(`${out}/live-window-b.webm`);await browser.close();console.log(JSON.stringify({samples:samples.length,cls,errors,queued,winner:result.winner}));
})().catch(e=>{console.error(e);process.exit(1);});
