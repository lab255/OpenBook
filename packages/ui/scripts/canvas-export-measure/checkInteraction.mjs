/* global window, document, getComputedStyle, CanvasRenderingContext2D */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const {chromium}=createRequire(new URL('../../../web/package.json',import.meta.url))('@playwright/test');
const origin=process.env.BUILD6_ORIGIN??'http://127.0.0.1:5186';
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:Number(process.env.BUILD6_WIDTH??1100),height:900},deviceScaleFactor:1});
 await page.addInitScript(()=>{window.__OB_NO_HYDRATE=true;
  window.cameraInputs=new WeakMap();
  const translate=CanvasRenderingContext2D.prototype.translate,scale=CanvasRenderingContext2D.prototype.scale;
  CanvasRenderingContext2D.prototype.scale=function(x,y){const camera=window.cameraInputs.get(this);if(camera)camera.zoom=x;return scale.call(this,x,y);};
  CanvasRenderingContext2D.prototype.translate=function(x,y){window.cameraInputs.set(this,{x:window.originZoomControl?0:x,y:window.originZoomControl?0:y});return translate.call(this,window.originZoomControl?0:x,window.originZoomControl?0:y);};});
 await page.goto(`${origin}/canvas-export.html`);
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
  const matrix=canvas.getContext('2d').getTransform();
  return {width:canvas.width,height:canvas.height,camera:window.cameraInputs.get(canvas.getContext('2d')),matrix:{a:matrix.a,d:matrix.d,e:matrix.e,f:matrix.f},hash,kept:!!document.querySelector('[data-canvas-fallback] img'),originalPreserved:!!window.originalDrawing.querySelector('[data-canvas-fallback] img')};
 });
 const before=await read();assert(before.kept&&before.originalPreserved);
 const box=await page.locator('canvas').boundingBox();assert(box);
 await page.mouse.move(box.x+100,box.y+100);await page.mouse.down();await page.mouse.move(box.x+140,box.y+120,{steps:4});await page.mouse.up();
 const focus=()=>page.locator('canvas').evaluate(canvas=>{const figure=canvas.closest('figure'),s=getComputedStyle(figure);const token=document.createElement('div');token.style.outline='2px solid hsl(var(--ring))';figure.append(token);const expected=getComputedStyle(token).outlineColor;token.remove();return {active:document.activeElement===canvas,visible:canvas.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor,expected,radius:s.borderRadius};});
 const assertPointer=s=>{assert(s.active);assert.equal(s.visible,false);assert.equal(s.outline,'none');};
 const pointerFocus=await focus();assertPointer(pointerFocus);
 await page.locator('figure').evaluate(e=>{e.style.outline='2px solid blue';});
 const pointerControl=await focus();assert.throws(()=>assertPointer(pointerControl));await page.locator('figure').evaluate(e=>e.style.removeProperty('outline'));
 // Native keyboard navigation, not focus() pretending to be keyboard input.
 await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
 const assertKeyboard=s=>{assert(s.active&&s.visible);assert.equal(s.outline,'solid');assert.equal(s.width,'2px');assert.equal(s.color,s.expected);assert.notEqual(s.radius,'0px');};
 const keyboardFocus=await focus();assertKeyboard(keyboardFocus);
 await page.locator('figure').evaluate(e=>{e.style.outline='none';});const keyboardControl=await focus();assert.throws(()=>assertKeyboard(keyboardControl));await page.locator('figure').evaluate(e=>e.style.removeProperty('outline'));
 // Model a browser without :has support by removing only those conditional rules.
 await page.evaluate(()=>{window.focusRules=[];for(const sheet of document.styleSheets)for(let i=sheet.cssRules.length-1;i>=0;i--){const rule=sheet.cssRules[i];if(rule.cssText.includes(':has(')){window.focusRules.push({sheet,index:i,text:rule.cssText});sheet.deleteRule(i);}}});
 const fallback=()=>page.locator('canvas').evaluate(c=>{const s=getComputedStyle(c);return {visible:c.matches(':focus-visible'),style:s.outlineStyle,width:s.outlineWidth,color:s.outlineColor};});
 const fallbackFocus=await fallback();const assertFallback=s=>{assert(s.visible);assert.equal(s.style,'solid');assert.equal(s.width,'2px');assert.equal(s.color,keyboardFocus.expected);};assertFallback(fallbackFocus);
 await page.locator('canvas').evaluate(c=>{c.style.outline='none';});const fallbackControl=await fallback();assert.throws(()=>assertFallback(fallbackControl));
 await page.locator('canvas').evaluate(c=>c.style.removeProperty('outline'));
 await page.evaluate(()=>{for(const {sheet,index,text} of window.focusRules.reverse())sheet.insertRule(text,index);});
 const pan=await read();assert.notEqual(pan.hash,before.hash);
 await page.locator('canvas').press('0');assert.deepEqual(await read(),before);
 await page.locator('canvas').press('+');const zoom=await read();assert.notEqual(zoom.hash,before.hash);
 const assertCentre=(start,end)=>{const ratio=end.camera.zoom/start.camera.zoom;
  assert.equal(end.camera.x,start.width/2+(start.camera.x-start.width/2)*ratio);
  assert.equal(end.camera.y,start.height/2+(start.camera.y-start.height/2)*ratio);
  for(const value of [start,end])assert.deepEqual(value.matrix,{a:Math.fround(value.camera.zoom),d:Math.fround(value.camera.zoom),e:Math.fround(value.camera.x),f:Math.fround(value.camera.y)});
 };
 assertCentre(before,zoom);
 await page.locator('canvas').press('0');await page.locator('canvas').press('ArrowRight');const panned=await read();await page.locator('canvas').press('+');const pannedZoom=await read();assertCentre(panned,pannedZoom);
 await page.locator('canvas').press('0');await page.evaluate(()=>{window.originZoomControl=true;});await page.locator('canvas').press('+');const originControl=await read();assert.throws(()=>assertCentre(before,originControl));await page.evaluate(()=>{window.originZoomControl=false;});
 await page.locator('canvas').press('0');assert.deepEqual(await read(),before);
 await page.evaluate(()=>{window.drawingHandle.unmount();window.drawingHandle=window.mountDrawing();});
 await page.waitForSelector('canvas');assert.deepEqual(await read(),before);
 // Scope control: a consumed stored node would make this retained-root check fail.
 const retainedControl=await page.evaluate(()=>{
  const copy=window.originalDrawing.cloneNode(true);copy.querySelector('[data-canvas-fallback]').remove();return !!copy.querySelector('[data-canvas-fallback] img');
 });assert.equal(retainedControl,false);
 const result={viewport:page.viewportSize(),canvasBox:box,scope:'Production viewer public mount; native Playwright pointer pan and keyboard zoom/reset. Pixel hashes prove changes/restoration, not physical presentation latency. Exact f64 camera arguments prove viewport-centred zoom; exact Math.fround conversions prove Canvas2D readback quantization before/after pan, with origin-translation mutant firing. Native pointer drag and keyboard Tab/Shift+Tab prove both focus paths, with CSS ring mutants firing. Kept node survives unmount/remount; destructive-copy control fires.',viewerSha256:createHash('sha256').update(readFileSync(new URL('../../src/export/vendor/openbook-viewer.js',import.meta.url))).digest('hex'),before,pan,zoom,panned,pannedZoom,originControl,pointerFocus,keyboardFocus,pointerControl,keyboardControl,fallbackFocus,fallbackControl,remountMatches:true,retainedControl};
 writeFileSync(process.env.BUILD6_INTERACTION_OUTPUT,JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
