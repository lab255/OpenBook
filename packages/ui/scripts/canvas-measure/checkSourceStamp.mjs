import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceStamp} from './sourceStamp.mjs';
import assert from 'node:assert/strict';
import {openHarness} from './openHarness.mjs';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const results=[];
const subject=new URL('../../src/blockeditor/canvas/presence.ts',import.meta.url),original=readFileSync(subject);
const baseline=sourceStamp();writeFileSync(subject,original);assert.equal(sourceStamp(),baseline); // Same content, changed mtime.

for(const control of [true,false]){
 const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
 try{
  const page=await browser.newPage();
  if(control){
   writeFileSync(subject,Buffer.concat([original,Buffer.from('\n// Planted real source edit: source-stamp negative control.\n')]));
   assert.notEqual(sourceStamp(),baseline);
   const error=page.waitForEvent('pageerror');await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');
   const message=(await error).message;assert.match(message,/Stale canvas measurement source/);
   assert.equal(await page.getByRole('region').count(),0);results.push({control,blocked:true,message});
  }else{const stamp=await openHarness(page);await page.getByRole('region').waitFor();results.push({control,stamp,matchedDisk:true});}
 }finally{writeFileSync(subject,original);await browser.close();}
}
writeFileSync(new URL('../../../../_evidence-build5/round3-source-stamp.json',import.meta.url),JSON.stringify({scope:'All UI src (.js/.json included), measurement source/config and SDK dist. CONTENT hash vs served bundle before mount; real source edit blocks mounting; identical-byte rewrite passes.',results},null,2));
