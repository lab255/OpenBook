/* global window, document, getComputedStyle */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(new URL('../../../web/package.json',import.meta.url))('@playwright/test');
const origin=process.env.BUILD6_ORIGIN??'http://127.0.0.1:5186';
const control=readFileSync(process.env.BUILD6_CAMERA_CONTROL_VIEWER,'utf8');
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(sha(control),'3c47b972581e8b88b06d530fd0c45dca947d09aa256476b3587001371aac72dc','Control must be the measured 4315517c production runtime');
const rows=[];
// The old production runtime is the firing control, not a simulated parse failure.
for(const runtime of ['current','4315517c-control'])for(const attribute of [null,'not JSON','null','{}','{"zoom":0}']) {
 const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
 try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
  await page.addInitScript(()=>{window.__OB_NO_HYDRATE=true;});
  await page.goto(`${origin}/canvas-export.html`);
  assert.equal(await page.locator('[data-canvas-camera]').count(),0,'Writer must not serialize camera input');
  if(runtime!=='current')await page.evaluate(`window.OpenBookViewer=undefined;${control};window.OpenBookViewer=OpenBookViewer;`);
  const result=await page.evaluate(async attribute=>{
   const original=document.querySelector('[data-canvas-export]').cloneNode(true);
   const image=original.querySelector('img');await image.decode();
   const reference=document.createElement('canvas');reference.width=image.naturalWidth;reference.height=image.naturalHeight;
   reference.getContext('2d').drawImage(image,0,0);
   const expected=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data;
   if(attribute!==null)original.querySelector('[data-canvas-fallback]').setAttribute('data-canvas-camera',attribute);
   const source=JSON.parse(document.querySelector('script[type="application/openbook+json"]').textContent);
   const host=document.createElement('div');document.querySelector('main').replaceWith(host);
   window.cameraInputHandle=window.OpenBookViewer.mount(host,source,{staticBlocks:{drawing:original}});
   await new Promise(resolve=>window.requestAnimationFrame(()=>window.requestAnimationFrame(resolve)));
   const canvas=host.querySelector('canvas'),fallback=host.querySelector('[data-canvas-fallback]');
   let changed=null,ink=0;
   if(canvas){
    const actual=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    changed=Math.abs(actual.length-expected.length);
    for(let i=0;i<actual.length;i++)if(actual[i]!==expected[i])changed++;
    for(let i=3;i<actual.length;i+=4)if(actual[i])ink++;
   }
   return {canvas:!!canvas,fallback:!!fallback,fallbackVisibility:fallback?getComputedStyle(fallback).visibility:null,changed,ink,text:host.innerText};
  },attribute);
  console.log(JSON.stringify({runtime,attribute,...result}));
  const visibleDrawing=value=>{assert(value.canvas,'Drawing replaced by error boundary');assert.equal(value.changed,0,'Drawing pixels disappeared/changed');assert(value.ink>0,'Drawing is blank');};
  if(runtime==='current'||attribute===null)visibleDrawing(result);
  else {
   assert.throws(()=>visibleDrawing(result),'Old runtime must fail the same visible-drawing assertion');
   if(attribute==='not JSON'){assert.equal(result.canvas,false);assert.equal(result.fallback,false);}
   else {assert.equal(result.canvas,true);assert.equal(result.fallbackVisibility,'hidden');assert(result.changed>0);if(attribute==='{"zoom":0}')assert.equal(result.ink,0);}
  }
  rows.push({runtime,attribute,...result});
 }finally{await browser.close();}
}
const result={scope:'Actual export and public viewer mount, DPR1. Obsolete/damaged camera attributes are inert; source scene alone determines fit. Every new-runtime drawing is pixel-identical to the good kept raster. Previous production bundle fires BOTH error-boundary loss and hidden-fallback/blank-canvas controls. Harness switches only the runtime for controls.',viewerSha256:sha(readFileSync(new URL('../../src/export/vendor/openbook-viewer.js',import.meta.url))),controlSha256:sha(control),rows};
writeFileSync(process.env.BUILD6_CAMERA_OUTPUT,JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
