import {openHarness} from './openHarness.mjs';
// Numeric native-browser evidence only; visual captures remain manager-owned.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const result={method:'Native Chromium, DPR1, 1280x800, 800px canvas; hint contrast measured against its bounded backing chip, not the document paper.',hints:[],themes:[]};
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
const ratio=(a,b)=>{const lum=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
try {
 const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
 await page.bringToFront();
 await openHarness(page);await page.getByRole('region').waitFor();await page.evaluate(()=>document.fonts.ready);
 for(const theme of ['light','dark']){
  for(const paper of ['#ffffff','#172554']){
   await page.evaluate(({theme,paper})=>{document.documentElement.classList.toggle('dark',theme==='dark');window.canvasEvidence.reset(0);window.canvasEvidence.background(paper);},{theme,paper});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const hint=await page.evaluate(()=>{
    const lum=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
    const el=document.querySelector('.ob-canvas-hint'),s=getComputedStyle(el),r=el.getBoundingClientRect(),v=document.querySelector('.ob-canvas-viewport').getBoundingClientRect(),a=lum(s.color),b=lum(s.backgroundColor);
    return {text:s.color,backing:s.backgroundColor,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),chip:{width:r.width,height:r.height},viewport:{width:v.width,height:v.height},overlay:getComputedStyle(el.parentElement).backgroundColor};
   });result.hints.push({theme,paper,...hint});
   if(hint.contrast<4.5||hint.chip.width>=hint.viewport.width||hint.chip.height>=hint.viewport.height||hint.overlay!=='rgba(0, 0, 0, 0)')throw new Error('Hint legibility/backing scope failed');
  }
  await page.getByRole('region').focus();await page.keyboard.press('Enter');
  const unavailable=await page.getByRole('button',{name:'Arrange',exact:true}).evaluate(el=>{const s=getComputedStyle(el);return {ariaDisabled:el.getAttribute('aria-disabled'),cursor:s.cursor,color:s.color,background:s.backgroundColor,chrome:getComputedStyle(document.querySelector('.ob-canvas')).backgroundColor,outline:s.outlineColor,outlineWidth:s.outlineWidth};});
  const swatch=await page.getByRole('button',{name:'Stroke: Ink',exact:true}).evaluate(el=>{const mark=el.querySelector('span'),s=getComputedStyle(mark),r=mark.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {mark:mark.textContent,color:s.color,backing:s.backgroundColor,aboveSwatch:hit===mark};});
  unavailable.boundaryContrast=ratio(unavailable.outline,unavailable.chrome);
  swatch.contrast=ratio(swatch.color,swatch.backing);
  const pressed=page.locator('.ob-canvas-tools [aria-pressed=true]');
  const rect=await pressed.boundingBox();
  const sample=async()=>{
   const png=await page.screenshot({clip:rect,animations:'disabled'});
   return page.evaluate(async base64=>{
    const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);
    return Array.from({length:8},(_,y)=>({x:18,y,rgba:[...context.getImageData(18,y,1,1).data]}));
   },png.toString('base64'));
  };
  await page.getByRole('region').focus();const unfocused=await sample();await page.keyboard.press('Tab');
  const focused=await sample(),style=await pressed.evaluate(el=>{const s=getComputedStyle(el);return {focusVisible:el.matches(':focus-visible'),accent:s.outlineColor,gap:s.color,fill:s.backgroundColor,shadow:s.boxShadow};});
  const rgb=color=>color.match(/[\d.]+/g).slice(0,3).map(Number);
  const equals=(pixel,color)=>pixel.rgba.slice(0,3).every((v,i)=>v===rgb(color)[i]);
  const ring={method:'Foreground single-process Chromium DPR1 at native resolution; screenshot buffer sampled in memory only, no image saved/published. Coordinates relative to 36px pressed Pen button crop; unfocused control removes the gap.',viewportClip:rect,style,focused,unfocused,contrast:ratio(style.accent,style.gap)};
  if(!style.focusVisible||!focused.slice(0,2).every(p=>equals(p,style.accent))||!focused.slice(2,4).every(p=>equals(p,style.gap))||!focused.slice(4,8).every(p=>equals(p,style.fill))||!unfocused.every(p=>equals(p,style.fill))||ring.contrast<3||unavailable.boundaryContrast<3||swatch.contrast<4.5)throw new Error('Pixel ring/disabled boundary/swatch contrast failed: '+JSON.stringify(ring));
  await page.getByLabel('Drawing viewport').focus();await page.keyboard.press('r');await page.keyboard.press('Enter');
  const selection=await page.evaluate(()=>{const strip=document.querySelector('.ob-canvas-properties'),children=[...strip.querySelector('fieldset').children].map(el=>({label:el.textContent,rect:el.getBoundingClientRect().toJSON()}));return {strip:strip.getBoundingClientRect().toJSON(),footer:document.querySelector('.ob-canvas-footer').getBoundingClientRect().toJSON(),rows:Math.round((strip.getBoundingClientRect().height-16+8)/36),children};});
  if(selection.rows>2)throw new Error('Simple-shape properties exceed two rows');
  if(unavailable.ariaDisabled!=='true'||unavailable.cursor!=='default'||swatch.mark!=='✓'||!swatch.aboveSwatch)throw new Error('Unavailable action or swatch marker failed');
  result.themes.push({theme,unavailable,swatch,ring,selection});
 }
 writeFileSync(new URL('../../../../_evidence-build4/legibility-refresh.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
