/* global window, document, Image */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const origin=process.env.BUILD6_ORIGIN??'http://127.0.0.1:5186';
const {chromium}=createRequire(new URL('../../../web/package.json',import.meta.url))('@playwright/test');
const output=process.env.BUILD6_PAINT_OUTPUT;
assert(output,'BUILD6_PAINT_OUTPUT required');
const launch=()=>chromium.launch({headless:true,args:['--single-process','--no-zygote']});
let browser=await launch(),fixture;
try {
 const page=await browser.newPage();await page.goto(`${origin}/`);await page.waitForFunction(()=>window.exportCanvasFixture);
 fixture=await page.evaluate(mixed=>window.exportCanvasFixture(mixed),process.env.BUILD6_MIXED??'rich');
 for(const [path,hash] of Object.entries(fixture.stamp))assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),hash);
 writeFileSync(new URL('./dist/document-paint.html',import.meta.url),fixture.html);
}finally{await browser.close();}
let before,rect,caption;const rows=[];
for(const js of [false,true]) {
 browser=await launch();
 try {
  const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1,javaScriptEnabled:js});
  await page.goto(`${origin}/document-paint.html`);
  if(js)await page.waitForSelector('[data-canvas-export] canvas');
  await page.evaluate(()=>document.fonts.ready);
  const current=await page.locator('[data-canvas-export]').evaluate(e=>e.getBoundingClientRect().toJSON());
  const captionBox=await page.locator('[data-canvas-export] summary').evaluate(e=>e.getBoundingClientRect().toJSON());
  const screenshot=await page.screenshot({fullPage:true});writeFileSync(`${output}.${js?'hydrated':'nojs'}.png`,screenshot);
  if(!js){before=screenshot.toString('base64');rect=current;caption=captionBox;continue;}
  assert.deepEqual(current,rect,'Figure mask geometry must match; do not hide a shift by enlarging the mask');
  assert.equal(captionBox.y,caption.y);assert.equal(captionBox.height,caption.height);
  // Intrinsic text width is diagnostic only; the unmasked strip is the paint contract.
  const compare=async after=>page.evaluate(async({before,after,rect,caption})=>{
   const read=async data=>{const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return {width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};};
   const a=await read(before),b=await read(after);if(a.width!==b.width||a.height!==b.height)throw new Error('Full-page dimensions changed');
   let changed=0,captionChanged=0,outsideChanged=0,population=0;const samples=[];
   for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++) {
    const inside=x>=Math.floor(rect.x)&&x<Math.ceil(rect.right)&&y>=Math.floor(rect.y)&&y<Math.ceil(rect.bottom);
    const strip=inside&&y>=Math.floor(caption.y)&&y<Math.ceil(caption.bottom);
    if(inside&&!strip)continue;
    population++;const i=(y*a.width+x)*4;
    if(a.data[i]!==b.data[i]||a.data[i+1]!==b.data[i+1]||a.data[i+2]!==b.data[i+2]||a.data[i+3]!==b.data[i+3]){changed++;if(strip)captionChanged++;else outsideChanged++;if(samples.length<10)samples.push({x,y,before:Array.from(a.data.slice(i,i+4)),after:Array.from(b.data.slice(i,i+4))});}
   }
   return {width:a.width,height:a.height,changed,captionChanged,outsideChanged,population,samples};
  },{before,after,rect,caption});
  const actual=await compare(screenshot.toString('base64'));
  await page.locator('h1').first().evaluate(e=>{e.style.color='red';});
  const control=await compare((await page.screenshot({fullPage:true})).toString('base64'));assert(control.outsideChanged>0,'Outside-figure paint meter must detect title ink change');
  await page.locator('h1').first().evaluate(e=>e.style.removeProperty('color'));
  await page.locator('[data-canvas-export] summary').evaluate(e=>{e.style.color='red';});
  const captionControl=await compare((await page.screenshot({fullPage:true})).toString('base64'));
  assert(captionControl.captionChanged>0,'Caption ink control must fire inside the figure');
  assert.equal(captionControl.outsideChanged,0,'Caption control must stay scoped to its strip');
  rows.push({actual,control,captionControl,rect,captionBefore:caption,captionAfter:captionBox});
  writeFileSync(output,JSON.stringify({scope:'Exact figure geometry plus exact pixels outside the figure AND in its unmasked caption strip. No tolerance. Independent title/caption ink controls.',stamp:fixture.stamp,rows},null,2));
  assert.equal(actual.changed,0,'Hydration changed document or caption paint');
 }finally{await browser.close();}
}
writeFileSync(output,JSON.stringify({scope:'Full-page DPR1 screenshots at1100×900, no-JS versus hydrated actual export. Every pixel outside the unchanged figure rectangle AND the full-width caption strip inside it. Internal intrinsic width is diagnostic, not a paint guarantee. Independent title/caption ink controls fire.',stamp:fixture.stamp,rows},null,2));
console.log(JSON.stringify(rows));
