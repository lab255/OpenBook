import {openHarness} from './openHarness.mjs';
// Native DOM/pointer measurements, no screenshots or video.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await openHarness(page);await page.getByRole('region').waitFor();
 await page.evaluate(()=>window.canvasEvidence.column(736));await page.getByRole('region').focus();await page.keyboard.press('Enter');
 await page.evaluate(()=>window.canvasEvidence.presence('join'));await page.locator('.ob-canvas-peer').waitFor();
 const peer=await page.locator('.ob-canvas-peer').boundingBox(),x=peer.x+6,y=peer.y+6;
 const target=()=>page.evaluate(({x,y})=>{const e=document.elementFromPoint(x,y);return {peer:!!e.closest('.ob-canvas-peer'),viewport:!!e.closest('.ob-canvas-viewport')};},{x,y});
 const pointer=await target();assert.deepEqual(pointer,{peer:false,viewport:true});
 const tabStops=await page.locator('.ob-canvas-peer').evaluate(el=>[el,...el.querySelectorAll('*')].filter(e=>e.tabIndex>=0).length);assert.equal(tabStops,0);
 await page.waitForTimeout(3100);assert.equal(await page.locator('.ob-canvas-peer-label').evaluate(el=>getComputedStyle(el).visibility),'hidden');
 await page.mouse.move(x,y);await page.waitForFunction(()=>document.querySelector('.ob-canvas-peer').dataset.hovered==='true');
 assert.equal(await page.locator('.ob-canvas-peer-label').evaluate(el=>getComputedStyle(el).visibility),'visible');assert.deepEqual(await target(),pointer);
 // A planted hit area proves elementFromPoint detects the original defect.
 await page.locator('.ob-canvas-peer').evaluate(el=>el.style.pointerEvents='auto');const control=await target();assert.equal(control.peer,true);await page.locator('.ob-canvas-peer').evaluate(el=>el.style.pointerEvents='');
 await page.mouse.click(x,y);await page.getByRole('region',{name:'Canvas, 1 objects, editable'}).waitFor();
 await page.mouse.move(peer.x-30,peer.y-30);await page.waitForFunction(()=>document.querySelector('.ob-canvas-peer').dataset.hovered==='false');
 await page.mouse.click(peer.x-30,peer.y-30);await page.getByRole('region',{name:'Canvas, 2 objects, editable'}).waitFor();
 const grid=[];
 for(const paper of ['#ffffff','#111111'])for(const theme of ['light','dark']){
  await page.evaluate(({paper,theme})=>{document.documentElement.classList.toggle('dark',theme==='dark');window.canvasEvidence.paper(paper);},{paper,theme});
  await page.getByLabel('Grid',{exact:true}).check();
  const color=await page.locator('.ob-canvas-grid').evaluate(el=>getComputedStyle(el).color);grid.push({paper,theme,color});
  await page.getByLabel('Grid',{exact:true}).uncheck();
 }
 assert.equal(grid[0].color,grid[1].color);assert.equal(grid[2].color,grid[3].color);assert.notEqual(grid[0].color,grid[2].color);
 await page.getByLabel('Snap',{exact:true}).check();await page.getByLabel('Drawing viewport',{exact:true}).focus();await page.keyboard.press('r');
 const viewport=await page.getByLabel('Drawing viewport',{exact:true}).boundingBox();await page.mouse.move(viewport.x+16,viewport.y+16);await page.mouse.down();await page.mouse.move(viewport.x+63,viewport.y+47);
 const guides=await page.locator('.ob-canvas-guide').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height};}));assert.equal(guides.length,2);assert(guides.every(g=>Math.max(g.width,g.height)===32));await page.mouse.up();
 const reload=await page.evaluate(()=>window.canvasEvidence.reload());assert.equal(reload,true);
 const result={scope:'Native Chromium DOM hit testing and mouse input at 736px, 1280x900. Hover and next pointerdown; peer and empty-paper mirror. Paper values × app themes. Synthetic local drawing, not hardware.',pointer,control,tabStops,grid,guides,reload};
 writeFileSync(new URL('../../../../_evidence-build5/round2-polish.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close();}
