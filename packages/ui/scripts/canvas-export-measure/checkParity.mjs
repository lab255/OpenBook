/* global window, document */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const results=[];
const assets=new URL('./dist/assets/',import.meta.url);
const built=Object.fromEntries(readdirSync(assets).map(name=>[name,createHash('sha256').update(readFileSync(new URL(name,assets))).digest('hex')]));
for(const dpr of [1,1.5,2]) {
  const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:dpr});
    await page.goto('http://127.0.0.1:5186/');
    for(const [name,hash] of Object.entries(built)) {
      const response=await page.request.get(`http://127.0.0.1:5186/assets/${name}`);
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'),hash,'Served bytes differ from built artifact');
    }
    await page.waitForFunction(()=>typeof window.runCanvasExportParity==='function');
    await page.evaluate(()=>document.fonts.ready);
    results.push(await page.evaluate(dpr=>window.runCanvasExportParity(dpr),dpr));
  } finally {await browser.close();}
}
assert.equal(results.length,3);assert(results.every(r=>r.rows.length===60));
const report={buildMode:'Vite production build + loopback preview',built,results};
writeFileSync(process.env.BUILD6_PARITY_OUTPUT,JSON.stringify(report,null,2));
assert.deepEqual(JSON.parse(readFileSync(process.env.BUILD6_PARITY_OUTPUT,'utf8')),report);
console.log('180 exact pixel cases passed, with firing clear-surface controls in every case.');
