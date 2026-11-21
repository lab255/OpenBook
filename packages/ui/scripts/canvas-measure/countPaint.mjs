import {openHarness} from './openHarness.mjs';
// Mechanism-matched paint work, not a latency rerun. Same 500x50-point scene
// and pointer coordinates as profile.mjs; no screenshots or CPU trace required.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const results=[];
for(const input of [{name:'desktop mouse synthetic/local',steps:1},{name:'trackpad-class mouse pointer synthetic/local',steps:3}]){
  const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
    await openHarness(page);await page.getByRole('region').waitFor();
    await page.evaluate(()=>window.canvasEvidence.reset(500));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.keyboard.press('p');
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(()=>{
      window.paintWork={stroke:0,fill:0,arc:0,clearRect:0,drawImage:0};
      for(const name of Object.keys(window.paintWork)){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){window.paintWork[name]++;return original.apply(this,args);};}
    });
    const box=await page.getByLabel('Drawing viewport').boundingBox(),samples=[];
    const count=async(run,event,operation)=>{
      const before=await page.evaluate(()=>window.paintWork);await operation();const after=await page.evaluate(()=>window.paintWork);
      samples.push({run,event,...Object.fromEntries(Object.keys(before).map(k=>[k,after[k]-before[k]]))});
    };
    for(let run=0;run<12;run++){
      const x=box.x+40+run*18,y=box.y+350;await page.mouse.move(x,y);
      await count(run+1,'pointerdown',()=>page.mouse.down());
      for(let step=1;step<=input.steps;step++)await count(run+1,`pointermove ${step}/${input.steps}`,()=>page.mouse.move(x+5*step/input.steps,y-5*step/input.steps));
      await count(run+1,'pointerup',()=>page.mouse.up());
    }
    results.push({input:input.name,initialScene:'500 strokes x 50 points; same harness reset and coordinates as before profile',samples,reloadEquivalent:await page.evaluate(()=>window.canvasEvidence.reload())});
  } finally {await browser.close();}
}
const result={label:'Instrumented Canvas2d call counts bracket each delivered pointer event, no latency claim',time:new Date().toISOString(),results};
writeFileSync(fileURLToPath(new URL('../../../../_evidence-build4/paint-work-after.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(results.map(r=>({input:r.input,firstGesture:r.samples.filter(s=>s.run===1),reloadEquivalent:r.reloadEquivalent})),null,2));
