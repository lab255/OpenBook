/* global window, document, Image */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(new URL('../../../web/package.json',import.meta.url))('@playwright/test');
const output=process.env.BUILD6_PAINT_OUTPUT;
assert(output,'BUILD6_PAINT_OUTPUT required');
const launch=()=>chromium.launch({headless:true,args:['--single-process','--no-zygote']});
let browser=await launch(),fixture;
try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:5186/');await page.waitForFunction(()=>window.exportCanvasFixture);
 fixture=await page.evaluate(()=>window.exportCanvasFixture('rich'));
 for(const [path,hash] of Object.entries(fixture.stamp))assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),hash);
 writeFileSync(new URL('./dist/document-paint.html',import.meta.url),fixture.html);
}finally{await browser.close();}
let before,rect;const rows=[];
for(const js of [false,true]) {
 browser=await launch();
 try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1,javaScriptEnabled:js});
  await page.goto('http://127.0.0.1:5186/document-paint.html');
  if(js)await page.waitForSelector('[data-canvas-export] canvas');
  await page.evaluate(()=>document.fonts.ready);
  const current=await page.locator('[data-canvas-export]').evaluate(e=>e.getBoundingClientRect().toJSON());
  const screenshot=await page.screenshot({fullPage:true});writeFileSync(`${output}.${js?'hydrated':'nojs'}.png`,screenshot);
  if(!js){before=screenshot.toString('base64');rect=current;continue;}
  assert.deepEqual(current,rect,'Figure mask geometry must match; do not hide a shift by enlarging the mask');
  const compare=async after=>page.evaluate(async({before,after,rect})=>{
   const read=async data=>{const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};};
   const a=await read(before),b=await read(after);if(a.width!==b.width||a.height!==b.height)throw new Error('Full-page dimensions changed');
   let changed=0,population=0;const samples=[];
   for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++) {
    if(x>=Math.floor(rect.x)&&x<Math.ceil(rect.right)&&y>=Math.floor(rect.y)&&y<Math.ceil(rect.bottom))continue;
    population++;const i=(y*a.width+x)*4;
    if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3]){changed++;if(samples.length<10)samples.push({x,y,before:Array.from(a.data.slice(i,i+4)),after:Array.from(b.data.slice(i,i+4))});}
   }
   return {width:a.width,height:a.height,changed,population,samples};
  },{before,after,rect});
  const actual=await compare(screenshot.toString('base64'));
  await page.locator('h1').first().evaluate(e=>{e.style.color='red';});
  const control=await compare((await page.screenshot({fullPage:true})).toString('base64'));assert(control.changed>0,'Outside-figure paint meter must detect title ink change');
  rows.push({actual,control,rect});
  writeFileSync(output,JSON.stringify({scope:'Every full-page DPR1 pixel outside the exact unchanged figure rectangle. No tolerance. Title-ink firing control.',stamp:fixture.stamp,rows},null,2));
  assert.equal(actual.changed,0,'Hydration repainted document outside canvas figure');
 }finally{await browser.close();}
}
writeFileSync(output,JSON.stringify({scope:'Full-page DPR1 screenshots at1100×900, no-JS versus hydrated actual export. Every pixel outside the unchanged figure rectangle, including title, content H1, paragraphs and page background. Firing control changes title ink.',stamp:fixture.stamp,rows},null,2));
console.log(JSON.stringify(rows));
