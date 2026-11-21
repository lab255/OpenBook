import {openHarness} from './openHarness.mjs';
import {createRequire} from 'node:module';import {writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const results=[];
// The repository's single-process Chromium recipe uses one case per browser;
// closing/replacing its only context can terminate that browser process.
for(const dpr of [1,1.5,2]){
 const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
 try{const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:dpr});await openHarness(page);await page.getByRole('region').waitFor();const result=await page.evaluate(async()=>{const {rasterEquivalence}=await import('/scripts/canvas-measure/rasterEquivalence.ts');return rasterEquivalence();});results.push({dpr,...result});writeFileSync(fileURLToPath(new URL('../../../../_evidence-build4/raster-equivalence.json',import.meta.url)),JSON.stringify(results,null,2));console.log(JSON.stringify({dpr,pass:result.pass,cases:result.rows.length,failures:result.rows.filter(r=>r.phase==='settled'?r.changedPixels!==0:r.outsideActivePixels!==0),negativeControl:result.negativeControl},null,2));}finally{await browser.close();}
}
if(results.some(r=>!r.pass))process.exitCode=1;
