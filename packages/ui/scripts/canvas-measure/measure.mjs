/** Numeric measurements only. No screenshots, video, tracing, or public server. */
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const checksOnly=process.argv.includes('--checks-only'),inkOnly=process.argv.includes('--ink-only');
const output=fileURLToPath(new URL(`../../../../_evidence-build4/${checksOnly?'design-browser-checks':inkOnly?'browser-measurements-after':'browser-measurements'}.json`,import.meta.url));
const result={label:'Chromium synthetic/local, Canvas2d; rAF raster-availability estimate, not physical presentation',inputBoundary:'Both input classes use synthetic mouse PointerEvents. Trackpad-class denotes the browser pointer path, not a physical trackpad measurement.',time:new Date().toISOString(),immediacy:[]};
const save=()=>writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');
  await page.getByRole('region').waitFor();await page.evaluate(()=>document.fonts.ready);
  for(const inputClass of (checksOnly?[]:['desktop mouse synthetic/local','trackpad-class mouse pointer synthetic/local']))for(const condition of ['empty','500 strokes','500 strokes + concurrent remote edits']) {
    await page.evaluate(count=>window.canvasEvidence.reset(count),condition==='empty'?0:500);
    await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('p');
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const viewport=await page.getByLabel('Drawing viewport').boundingBox();
    const samples=[];
    if(condition.includes('remote'))await page.evaluate(()=>{window.remoteTimer=setInterval(()=>window.canvasEvidence.remote(),8);});
    for(let run=0;run<12;run++){
      const x=40+run*18,y=350;
      await page.evaluate(({x,y})=>{
        const viewport=document.querySelector('.ob-canvas-viewport'),canvas=viewport.querySelector('canvas'),ctx=canvas.getContext('2d');
        const before=ctx.getImageData(x-2,y-2,5,5).data.slice();
        window.inkSample=new Promise(resolve=>viewport.addEventListener('pointerdown',()=>{
          const started=performance.now();let frames=0;
          const sample=()=>{frames++;const now=ctx.getImageData(x-2,y-2,5,5).data;const changed=now.some((v,i)=>v!==before[i]);if(changed||frames===10)resolve({ms:performance.now()-started,frames,changed});else requestAnimationFrame(sample);};
          requestAnimationFrame(sample);
        },{capture:true,once:true}));
      },{x,y});
      await page.mouse.move(viewport.x+x,viewport.y+y);await page.mouse.down();
      const sample=await page.evaluate(()=>window.inkSample);samples.push({run:run+1,label:inputClass,...sample});
      await page.mouse.move(viewport.x+x+5,viewport.y+y-5,{steps:inputClass.startsWith('trackpad')?3:1});await page.mouse.up();
      if(!sample.changed)throw new Error(`No raster feedback: ${inputClass}/${condition}/${run}`);
    }
    await page.evaluate(()=>clearInterval(window.remoteTimer));
    const sorted=samples.map(s=>s.ms).sort((a,b)=>a-b),median=(sorted[5]+sorted[6])/2;
    const reloadEquivalent=await page.evaluate(()=>window.canvasEvidence.reload());
    result.immediacy.push({inputClass,condition,n:samples.length,median,worst:Math.max(...sorted),samples,reloadEquivalent});save();
    if(!reloadEquivalent)throw new Error('Fresh replica differs');
  }
  if(!inkOnly){
  result.cacheFidelity=await page.evaluate(()=>window.canvasEvidence.cacheFidelity());save();
  if(result.cacheFidelity.rows.some(r=>r.maxChannelDelta!==0)||result.cacheFidelity.negativeControl<=0)throw new Error('Committed raster differs from ordered reference');
  // A real LayoutShift observer, with all synthetic interactions settled first.
  await page.evaluate(()=>window.canvasEvidence.reset(0));await page.waitForTimeout(700);
  const cls=await page.evaluate(async()=>{
    let entries=[];const observer=new PerformanceObserver(list=>entries.push(...list.getEntries()));observer.observe({type:'layout-shift',buffered:false});
    const settle=()=>new Promise(r=>setTimeout(r,140));
    const cases=[];
    for(const name of ['peer join (document update)','saving','saved','save failed']){
      entries=[];
      if(name.startsWith('peer'))window.canvasEvidence.remote();else window.canvasEvidence.status(name);
      await settle();cases.push({name,cls:entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0),entries:entries.map(e=>({value:e.value,hadRecentInput:e.hadRecentInput}))});
    }
    // Canvas-specific deliberate violation: unsized canvas mounted above the
    // same surface, with no reserved holder geometry, shifts visible content.
    const holder=document.createElement('div');document.querySelector('main').insertBefore(holder,document.querySelector('.ob-canvas'));await settle();entries=[];
    holder.appendChild(document.createElement('canvas'));await settle();
    const negativeControl=entries.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0);observer.disconnect();holder.remove();
    return {label:'Synthetic local status transitions and document join application; real provider reconnect is measured separately',cases,negativeControl,negativeControlDescription:'Default-size canvas mounted into an unsized holder above the same canvas surface',reloadEquivalent:window.canvasEvidence.reload()};
  });
  result.cls=cls;save();if(cls.negativeControl<=0)throw new Error('CLS negative control failed to register a shift');
  result.reconnectCases=[];
  for(const singleTransaction of [true,false]){
  // Real providers, native transport, explicitly buffered document bytes.
  await page.evaluate(()=>window.canvasEvidence.reset(0));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('r');await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Objects',exact:true}).click();await page.getByLabel('Drawing viewport').focus();
  await page.evaluate(()=>window.canvasEvidence.startProviders());await page.waitForTimeout(100);
  const outage=await page.evaluate(singleTransaction=>{const original=window.canvasEvidence.scene().shapes[0];window.canvasEvidence.outage();const transactions=window.canvasEvidence.outageEdit(singleTransaction);return {singleTransaction,transactions,original,localDuringOutage:window.canvasEvidence.scene().shapes[0],transport:window.canvasEvidence.transportState(),agreement:window.canvasEvidence.providerAgreement()};},singleTransaction);
  await page.keyboard.press('ArrowDown');await page.waitForTimeout(700);
  result.reconnect=await page.evaluate(async(outage)=>{
    const inspect=()=>{const root=document.querySelector('.ob-canvas'),scene=window.canvasEvidence.scene(),matrix=root.querySelector('canvas').getContext('2d').getTransform();return {camera:{a:matrix.a,d:matrix.d,e:matrix.e,f:matrix.f},selection:[...root.querySelectorAll('[role=option][aria-selected=true]')].map(el=>scene.shapes[Number(el.dataset.objectIndex)].id),focus:document.activeElement.getAttribute('aria-label'),x:scene.shapes[0].scalars.x,y:scene.shapes[0].scalars.y,stroke:scene.shapes[0].scalars.stroke};};
    const before=inspect(),transportBefore=window.canvasEvidence.transportState(),shifts=[];
    const observer=new PerformanceObserver(list=>shifts.push(...list.getEntries()));observer.observe({type:'layout-shift',buffered:false});
    const delivery=window.canvasEvidence.reconnect(),frames=[];
    for(let i=0;i<12;i++){await new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));frames.push(inspect());}
    const after=inspect(),agreement=window.canvasEvidence.providerAgreement();observer.disconnect();
    return {label:'Two production connectBroadcast providers, native BroadcastChannel; document packets buffered then released unchanged. Not SSE/server certification.',outage,before,transportBefore,delivery,frames,after,agreement,layoutShifts:shifts.map(e=>({value:e.value,hadRecentInput:e.hadRecentInput,sources:e.sources.map(s=>({tag:s.node?.tagName,className:s.node?.className,text:s.node?.textContent?.slice(0,80),insideCanvas:!!s.node?.closest?.('.ob-canvas'),previous:s.previousRect.toJSON(),current:s.currentRect.toJSON()}))})),cls:shifts.filter(e=>!e.hadRecentInput).reduce((n,e)=>n+e.value,0)};
  },outage);save();
  const reconnect=result.reconnect;result.reconnectCases.push(reconnect);save();
  const expectedTransactions=singleTransaction?1:2;
  if(outage.transactions.length!==expectedTransactions||outage.transport.bufferedPackets!==expectedTransactions)throw new Error('Transaction/packet construction mismatch');
  const states=[{x:outage.original.scalars.x,stroke:outage.original.scalars.stroke},...outage.transactions];
  let lastState=0;
  for(const frame of reconnect.frames){const index=states.findIndex(state=>state.x===frame.x&&state.stroke===frame.stroke);if(index<lastState||index<0||frame.y!==outage.original.scalars.y+1)throw new Error('Frame is partial transaction or reversed transaction order');lastState=index;}
  if(lastState!==states.length-1)throw new Error('Reconnect did not reach final transaction');
  if(reconnect.cls!==0)throw new Error('Canvas reconnect CLS is nonzero');
  if(reconnect.transportBefore.bufferedPackets!==expectedTransactions+1||reconnect.delivery.bufferedBytes<=0||reconnect.delivery.deliveredBytes!==reconnect.delivery.bufferedBytes||outage.agreement.live||outage.localDuringOutage.scalars.x!==outage.original.scalars.x||!reconnect.agreement.live||!reconnect.agreement.fresh||JSON.stringify(reconnect.before.camera)!==JSON.stringify(reconnect.after.camera)||JSON.stringify(reconnect.before.selection)!==JSON.stringify(reconnect.after.selection)||reconnect.before.focus!==reconnect.after.focus)throw new Error('Buffered provider reconnect contract failed');
  }
  // Compare DOM selection bounds to the actual Canvas2d transform, at three zooms.
  await page.evaluate(()=>window.canvasEvidence.reset(0));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('r');await page.keyboard.press('Enter');
  await page.getByLabel('Width',{exact:true}).fill('40');await page.getByLabel('Width',{exact:true}).press('Tab');await page.getByLabel('Height',{exact:true}).fill('30');await page.getByLabel('Height',{exact:true}).press('Tab');
  const align=()=>page.evaluate(()=>{
    const v=document.querySelector('.ob-canvas-viewport'),canvas=v.querySelector('canvas'),outline=v.querySelector('.ob-canvas-outline');
    const t=canvas.getContext('2d').getTransform(),s=window.canvasEvidence.scene().shapes[0].scalars,r=v.getBoundingClientRect(),b=outline.getBoundingClientRect();
    const expected={x:t.a*s.x+t.e,y:t.d*s.y+t.f,w:t.a*s.w,h:t.d*s.h};
    const actual={x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height};
    return {expected,actual,error:Math.max(...Object.keys(expected).map(k=>Math.abs(expected[k]-actual[k])))};
  });
  result.precision={label:'DOM outline versus actual Canvas2d rendering matrix, CSS pixels; no screenshot-derived claim',alignments:[]};
  for(const zoom of [100,200,400]){await page.getByLabel('Zoom percentage').fill(String(zoom));await page.getByLabel('Zoom percentage').press('Tab');await page.evaluate(()=>new Promise(requestAnimationFrame));result.precision.alignments.push({zoom,...await align()});}
  await page.getByLabel('Zoom percentage').fill('100');await page.getByLabel('Zoom percentage').press('Tab');const initial=await align();
  for(let i=0;i<20;i++)for(const zoom of [200,400,100]){await page.getByLabel('Zoom percentage').fill(String(zoom));await page.getByLabel('Zoom percentage').press('Tab');}
  const final=await align();result.precision.cycles=20;result.precision.drift=Math.max(...Object.keys(initial.actual).map(k=>Math.abs(initial.actual[k]-final.actual[k])));
  await page.evaluate(()=>{const el=document.querySelector('.ob-canvas-outline');el.style.left=`${parseFloat(el.style.left)+2}px`;});result.precision.negativeControl=(await align()).error;
  if(result.precision.negativeControl<=0)throw new Error('Alignment negative control failed');save();
  result.restraint=await page.evaluate(async()=>{
    const root=document.querySelector('.ob-canvas');
    const pixel=document.createElement('canvas');pixel.width=pixel.height=1;const pixelContext=pixel.getContext('2d');
    const meter=()=>{
      let offTokenDurations=0,opacityDerivedTextColors=0;
      for(const el of root.querySelectorAll('*')){const style=getComputedStyle(el);for(const value of [...style.transitionDuration.split(','),...style.animationDuration.split(',')]){const ms=parseFloat(value)*1000;if(ms!==0&&![80,160,240].includes(ms))offTokenDurations++;}
        if([...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())){pixelContext.clearRect(0,0,1,1);pixelContext.fillStyle=style.color;pixelContext.fillRect(0,0,1,1);if(pixelContext.getImageData(0,0,1,1).data[3]<255)opacityDerivedTextColors++;}
      }return {offTokenDurations,opacityDerivedTextColors};
    };
    const observed=meter(),button=root.querySelector('.ob-canvas-title');button.style.transitionProperty='none';button.style.transitionDuration='123ms';button.style.color='rgba(0,0,0,.4)';await new Promise(requestAnimationFrame);const plantedComputedColor=getComputedStyle(button).color,elementOpacity=getComputedStyle(button).opacity,negativeControl=meter();button.style.transitionDuration='';button.style.color='';button.style.transitionProperty='';return {observed,negativeControl,plantedComputedColor,elementOpacity,method:'Resolve computed text colors to RGBA pixels; count color alpha below 255, independently of element opacity'};
  });
  if(result.restraint.negativeControl.offTokenDurations<=0||result.restraint.negativeControl.opacityDerivedTextColors<=0)throw new Error('Restraint negative control failed');save();
  result.legibility=await page.evaluate(()=>{
    const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
    const luminance=values=>values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
    const ratio=(a,b)=>{const x=luminance(rgb(a)),y=luminance(rgb(b));return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
    const rows=[];
    for(const [role,selector] of [['title','.ob-canvas-title'],['control','.ob-canvas-tools button'],['label','.ob-canvas-properties label'],['numeric','.ob-canvas-footer input'],['status','.ob-canvas-status'],['body','.ob-canvas-footer button']]){
      const el=document.querySelector(selector),s=getComputedStyle(el);let ancestor=el,background=s.backgroundColor;
      while(background==='rgba(0, 0, 0, 0)'&&ancestor.parentElement){ancestor=ancestor.parentElement;background=getComputedStyle(ancestor).backgroundColor;}
      rows.push({role,selector,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight,color:s.color,background,contrast:ratio(s.color,background)});
    }
    const root=getComputedStyle(document.querySelector('.ob-canvas')),pressed=getComputedStyle(document.querySelector('.ob-canvas-tools [aria-pressed=true]')),field=getComputedStyle(document.querySelector('.ob-canvas input'));
    return {textRoles:rows,boundaries:[{role:'pressed tool fill against chrome',contrast:ratio(pressed.backgroundColor,root.backgroundColor)},{role:'pressed tool icon against fill',contrast:ratio(pressed.color,pressed.backgroundColor)},{role:'field boundary',contrast:ratio(field.borderTopColor,field.backgroundColor)}]};
  });
  }
  result.browserErrors=errors;result.completed=new Date().toISOString();save();
  if(errors.length)throw new Error(errors.join('\n'));
  console.log(JSON.stringify({immediacy:result.immediacy.map(({inputClass,condition,n,median,worst})=>({inputClass,condition,n,median,worst})),cls:result.cls,precision:result.precision,restraint:result.restraint,legibility:result.legibility},null,2));
} catch(error){result.failure=String(error);save();throw error;}finally{await browser.close();}
