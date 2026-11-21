import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {openHarness} from './openHarness.mjs';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const results=[];
for(const control of [true,false]){
 const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
 try{
  const page=await browser.newPage();
  if(control){
   await page.route('**/__canvas-source',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({stamp:'planted-stale-stamp'})}));
   const error=page.waitForEvent('pageerror');await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');
   const message=(await error).message;assert.match(message,/Stale canvas measurement source/);
   assert.equal(await page.getByRole('region').count(),0);results.push({control,blocked:true,message});
  }else{const stamp=await openHarness(page);await page.getByRole('region').waitFor();results.push({control,stamp,matchedDisk:true});}
 }finally{await browser.close();}
}
writeFileSync(new URL('../../../../_evidence-build5/round2-source-stamp.json',import.meta.url),JSON.stringify({scope:'All UI src and canvas measurement source/config. Bundle stamp vs current disk, before canvas mounts; planted mismatch must block mounting.',results},null,2));
