/* global window, document, getComputedStyle */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const origin=process.env.BUILD6_ORIGIN??'http://127.0.0.1:5186';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const viewportWidth=Number(process.env.BUILD6_WIDTH??1100);
const dpr=Number(process.env.BUILD6_DPR??1),runs=Number(process.env.BUILD6_RUNS??10);
const launch=()=>chromium.launch({headless:true,args:['--single-process','--no-zygote']});
let browser=await launch();
let exported;
try {
 const page=await browser.newPage({viewport:{width:viewportWidth,height:900},deviceScaleFactor:dpr});
 await page.goto(`${origin}/`);await page.waitForFunction(()=>window.exportCanvasFixture);
 exported=await page.evaluate(mixed=>window.exportCanvasFixture(mixed),process.env.BUILD6_MIXED||false);
 for(const [path,hash] of Object.entries(exported.stamp))assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),hash,'Built harness source drift');
 writeFileSync(new URL('./dist/canvas-export.html',import.meta.url),exported.html);
}finally{await browser.close();}
const rows=[];
for(const [run,js] of [false,...Array(runs).fill(true)].entries()) {
 browser=await launch();
 try {
  const page=await browser.newPage({viewport:{width:viewportWidth,height:900},deviceScaleFactor:dpr,javaScriptEnabled:js});
  if(js)await page.addInitScript(()=>{
   window.__OB_NO_HYDRATE=true;window.canvasShifts=[];
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.canvasShifts.push({value:e.value,sources:e.sources?.map(s=>({node:s.node?.outerHTML,previous:s.previousRect,current:s.currentRect}))});}).observe({type:'layout-shift',buffered:true});
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${origin}/canvas-export.html`);await page.waitForTimeout(800);
  const measure=()=>page.evaluate(()=>{
   const figure=document.querySelector('[data-canvas-export]');if(!figure)throw new Error('Missing canvas export');
   const r=figure.getBoundingClientRect(),image=figure.querySelector('img'),canvas=figure.querySelector('canvas');
   const paragraphs=Array.from(document.querySelectorAll('main > p,.ob-viewer .obe-text-paragraph')).map(e=>{const box=e.getBoundingClientRect();return {text:e.textContent,x:box.x,y:box.y,width:box.width,height:box.height};});
   return {paragraphs,rect:{x:r.x,y:r.y,width:r.width,height:r.height},text:figure.textContent,hasImage:!!image,imageLoaded:!!image?.naturalWidth,hasCanvas:!!canvas,canvasVisible:canvas?getComputedStyle(canvas).visibility:null,body:document.body.innerText,styles:{figure:getComputedStyle(figure).cssText}};
  });
  assert.equal(await page.evaluate(()=>window.innerWidth),viewportWidth,'Actual viewport width');
  const before=await measure();assert(before.imageLoaded);assert(!before.hasCanvas);assert(!before.body.includes('Unsupported block'));
  if(js) {
   const boot=await page.evaluate(()=>Array.from(document.scripts).find(s=>s.textContent.includes('main.querySelectorAll')&&s.textContent.includes('cloneNode'))?.textContent);
   assert(boot,'Original boot must exist');await page.evaluate(()=>{window.__OB_NO_HYDRATE=false;window.canvasShifts=[];});
   await page.evaluate(boot);await page.waitForSelector('[data-canvas-export] canvas');await page.waitForTimeout(800);
   const after=await measure(),shifts=await page.evaluate(()=>window.canvasShifts);
   const parity=await page.evaluate(async()=>{
    const figure=document.querySelector('[data-canvas-export]'),image=figure.querySelector('img'),canvas=figure.querySelector('canvas');
    if(!image||!canvas)throw new Error('Kept image or canvas missing');await image.decode();
    const reference=document.createElement('canvas');reference.width=canvas.width;reference.height=canvas.height;reference.getContext('2d').drawImage(image,0,0);
    const a=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data,b=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let changed=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])changed++;return {changed,width:canvas.width,height:canvas.height};
   });
   assert.deepEqual(after.rect,before.rect,'Hydration geometry changed');
   assert.deepEqual(after.paragraphs,before.paragraphs,'Surrounding paragraph geometry changed');
   assert.equal(after.text,before.text);assert.equal(parity.changed,0,'PNG/live pixels differ');
   assert.equal(shifts.reduce((sum,s)=>sum+s.value,0),0,'Hydration CLS');assert.deepEqual(errors,[]);
   await page.evaluate(()=>{window.canvasShifts=[];const box=document.querySelector('[data-canvas-export]').firstElementChild;box.style.height=`${box.getBoundingClientRect().height+40}px`;});
   await page.waitForTimeout(700);
   const control=await page.evaluate(()=>window.canvasShifts.reduce((sum,s)=>sum+s.value,0));
   assert(control>0,'CLS control did not fire');
   rows.push({run,js,before,after,shifts,parity,control,errors});
  }else rows.push({js,before,errors});
 }finally{await browser.close();}
}
const output=process.env.BUILD6_HANDOFF_OUTPUT;
writeFileSync(output,JSON.stringify({scope:`Actual toHtml output, production-built viewer, delayed original boot with no local input or scrolling, DPR${dpr} ${viewportWidth}x900. CLS excludes input-window shifts and cannot reliably observe replacement-tree motion: exact before/after geometry is separately asserted. Control grows stable canvas viewport by 40px, shifting existing summary. One no-JS + ${runs} hydration runs. No screenshots.`,viewport:{width:viewportWidth,height:900},stamp:exported.stamp,surfaces:exported.surfaces,htmlBytes:Buffer.byteLength(exported.html),rows},null,2));
assert.deepEqual(JSON.parse(readFileSync(output,'utf8')).rows,rows);
console.log(JSON.stringify({runs:rows.length,hydrationMedian:0,controlMinimum:Math.min(...rows.filter(r=>r.js).map(r=>r.control)),pixelDifference:0}));
