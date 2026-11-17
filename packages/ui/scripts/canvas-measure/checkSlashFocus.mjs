// Real BlockEditor + SlashMenu + registered renderers; native keyboard input.
// Numeric per-rAF focus/ring evidence only. No captures or public server.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const output=fileURLToPath(new URL('../../../../_evidence-build4/slash-focus.json',import.meta.url));
const result={method:'Native Chromium DPR1, production BlockEditor/SlashMenu integration. Type /query into the real contenteditable, press Enter, trace activeElement and computed focus ring per rAF for 900ms. No component focus call after insertion.',cases:[]};
const save=()=>writeFileSync(output,JSON.stringify(result,null,2)+'\n');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');await page.getByRole('region').waitFor();
 for(const type of ['canvas','slider']){
  await page.evaluate(()=>window.canvasEvidence.resetEditor());
  const input=page.locator('[data-block-row="entry"] [contenteditable="true"]').first();await input.waitFor();await input.focus();await page.keyboard.type('/'+type);await page.locator('.obe-slash').waitFor();
  await page.evaluate(type=>{
   window.slashFocusTrace=new Promise(resolve=>{
    document.addEventListener('keydown',function start(e){if(e.key!=='Enter')return;document.removeEventListener('keydown',start,true);const startTime=performance.now(),frames=[];
     const sample=()=>{const blocks=window.canvasEvidence.editorBlocks(),inserted=blocks.find(b=>b.type===type),active=document.activeElement,region=document.querySelector('.ob-canvas'),style=region?getComputedStyle(region):null,rect=region?.getBoundingClientRect();frames.push({ms:performance.now()-startTime,insertedId:inserted?.id??null,activeTag:active.tagName,activeLabel:active.getAttribute('aria-label'),activeRow:active.closest('[data-block-row]')?.getAttribute('data-block-row'),isCanvasRegion:active===region,focusVisible:region?.matches(':focus-visible')??false,outlineStyle:style?.outlineStyle,outlineWidth:style?.outlineWidth,outlineColor:style?.outlineColor,outlineOffset:style?.outlineOffset,ringInViewport:!!rect&&rect.left>=5&&rect.top>=5&&rect.right+5<=innerWidth&&rect.bottom+5<=innerHeight,penPressed:region?.querySelector('[aria-label="Pen (P)"]')?.getAttribute('aria-pressed')});if(performance.now()-startTime<900)requestAnimationFrame(sample);else resolve({type,blocks,frames});};requestAnimationFrame(sample);
    },true);
   });
  },type);
  await page.keyboard.press('Enter');const row=await page.evaluate(()=>window.slashFocusTrace);result.cases.push(row);save();
  const visibleFrames=row.frames.filter(f=>f.insertedId);if(!visibleFrames.length)throw new Error(`${type} never inserted`);
  if(type==='canvas'){
   if(visibleFrames.some(f=>!f.isCanvasRegion||!f.focusVisible||!f.ringInViewport||f.outlineStyle!=='solid'||parseFloat(f.outlineWidth)<2||f.penPressed!=='true'))throw new Error('Canvas slash insertion did not retain region focus and painted focus-ring styling');
  }else {
   const at=row.blocks.findIndex(b=>b.type===type),following=row.blocks[at+1];if(!following||following.type!=='paragraph'||visibleFrames.some(f=>f.isCanvasRegion||f.activeRow!==following.id))throw new Error('Non-opted slider did not retain following-paragraph focus policy');
  }
 }
 result.browserErrors=errors;save();if(errors.length)throw new Error(errors.join('\n'));
 console.log(JSON.stringify({cases:result.cases.map(r=>({type:r.type,frames:r.frames.length,first:r.frames[0],last:r.frames.at(-1)})),browserErrors:errors},null,2));
} catch(error){result.failure=String(error);save();throw error;}finally{await browser.close();}
