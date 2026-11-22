/* global window, document */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(new URL('../../../web/package.json',import.meta.url))('@playwright/test');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.__OB_NO_HYDRATE=true;});
 await page.goto('http://127.0.0.1:5186/canvas-export.html');
 await page.evaluate(()=>{
  const original=document.querySelector('[data-canvas-export]').cloneNode(true);
  const source=JSON.parse(document.querySelector('script[type="application/openbook+json"]').textContent);
  const host=document.createElement('div');document.querySelector('main').replaceWith(host);
  window.mountDrawing=()=>window.OpenBookViewer.mount(host,source,{staticBlocks:{drawing:original}});
  window.drawingHandle=window.mountDrawing();window.originalDrawing=original;
 });
 await page.waitForSelector('canvas');
 const read=()=>page.evaluate(()=>{
  const canvas=document.querySelector('canvas');if(!canvas)throw new Error('Missing viewer');
  const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let hash=0;for(const value of bytes)hash=(hash*31+value)|0;
  return {hash,kept:!!document.querySelector('[data-canvas-fallback] img'),originalPreserved:!!window.originalDrawing.querySelector('[data-canvas-fallback] img')};
 });
 const before=await read();assert(before.kept&&before.originalPreserved);
 await page.mouse.move(320,220);await page.mouse.down();await page.mouse.move(360,240,{steps:4});await page.mouse.up();
 const pan=await read();assert.notEqual(pan.hash,before.hash);
 await page.locator('canvas').press('0');assert.deepEqual(await read(),before);
 await page.locator('canvas').press('+');const zoom=await read();assert.notEqual(zoom.hash,before.hash);
 await page.locator('canvas').press('0');assert.deepEqual(await read(),before);
 await page.evaluate(()=>{window.drawingHandle.unmount();window.drawingHandle=window.mountDrawing();});
 await page.waitForSelector('canvas');assert.deepEqual(await read(),before);
 // Scope control: a consumed stored node would make this retained-root check fail.
 const retainedControl=await page.evaluate(()=>{
  const copy=window.originalDrawing.cloneNode(true);copy.querySelector('[data-canvas-fallback]').remove();return !!copy.querySelector('[data-canvas-fallback] img');
 });assert.equal(retainedControl,false);
 const result={scope:'Production viewer public mount; native Playwright pointer pan and keyboard zoom/reset. Pixel hashes prove changes/restoration, not physical presentation latency. Kept node survives unmount/remount; destructive-copy control fires.',viewerSha256:createHash('sha256').update(readFileSync(new URL('../../src/export/vendor/openbook-viewer.js',import.meta.url))).digest('hex'),before,pan,zoom,remountMatches:true,retainedControl};
 writeFileSync(process.env.BUILD6_INTERACTION_OUTPUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
