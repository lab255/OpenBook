import {openHarness} from './openHarness.mjs';
// Sustained active-stroke rAF raster availability; no physical latency claim.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const output=fileURLToPath(new URL('../../../../_evidence-build5/round2-sustained-ink.json',import.meta.url));
const result={method:'Native Chromium Canvas2d, DPR 1, same machine; 500 settled strokes plus >1000 active points. Synthetic mouse input, per-rAF changed-pixel availability, not physical presentation. Active samples are unsimplified; pointerup decimates storage at the unchanged 0.5-world-unit bound.',conditions:[]};
for(const condition of [{name:'desktop mouse synthetic/local',steps:1},{name:'trackpad-class mouse pointer synthetic/local',steps:3}]){
  const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
    await openHarness(page);await page.getByRole('region').waitFor();
    await page.evaluate(()=>window.canvasEvidence.reset(500));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('p');
    const v=await page.getByLabel('Drawing viewport').boundingBox();await page.mouse.move(v.x+40,v.y+280);await page.mouse.down();
    await page.evaluate(()=>{
      const viewport=document.querySelector('.ob-canvas-viewport'),r=viewport.getBoundingClientRect();
      for(let i=0;i<1000;i++)viewport.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,pointerType:'mouse',buttons:1,clientX:r.x+40+i%500,clientY:r.y+280+Math.floor(i/500)*20+Math.sin(i/8)*6}));
    });
    const samples=[];
    for(let run=0;run<12;run++){
      const x=550+run*4,y=340;
      // The trackpad-class path delivers three real moves; measure the last
      // event separately so the timer never includes waiting for later input.
      for(let step=1;step<condition.steps;step++)await page.mouse.move(v.x+x-3+step,v.y+y);
      await page.evaluate(({x,y})=>{
        const viewport=document.querySelector('.ob-canvas-viewport'),ctx=viewport.querySelector('canvas').getContext('2d'),before=ctx.getImageData(x-1,y-1,3,3).data.slice();
        window.sustainedSample=new Promise(resolve=>viewport.addEventListener('pointermove',()=>{
          const start=performance.now();let frames=0;
          const sample=()=>{frames++;const after=ctx.getImageData(x-1,y-1,3,3).data;const changed=after.some((n,i)=>n!==before[i]);if(changed||frames===10)resolve({ms:performance.now()-start,frames,changed});else requestAnimationFrame(sample);};requestAnimationFrame(sample);
        },{capture:true,once:true}));
      },{x,y});
      await page.mouse.move(v.x+x,v.y+y);samples.push({run:run+1,activePointsBeforeSample:1001+run*condition.steps+condition.steps-1,...await page.evaluate(()=>window.sustainedSample)});
    }
    const beforeUp=await page.evaluate(()=>window.canvasEvidence.scene().shapes.length);await page.mouse.up();
    const persistence=await page.evaluate(()=>{const scene=window.canvasEvidence.scene();return {shapes:scene.shapes.length,longestPoints:Math.max(...scene.shapes.map(s=>s.points.length/s.pointArity)),reloadEquivalent:window.canvasEvidence.reload()};});
    const values=samples.map(s=>s.ms).sort((a,b)=>a-b);const row={condition:condition.name,n:samples.length,median:(values[5]+values[6])/2,worst:Math.max(...values),samples,beforeUp,persistence};result.conditions.push(row);
    writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    if(samples.some(s=>!s.changed)||beforeUp!==500||persistence.shapes!==501||persistence.longestPoints<=0||persistence.longestPoints>1001+12*condition.steps||!persistence.reloadEquivalent)throw new Error('Sustained input measurement/persistence failed');
    console.log(JSON.stringify(row));
  } finally {await browser.close();}
}
if(result.conditions.some(c=>c.median>50))process.exitCode=2;
