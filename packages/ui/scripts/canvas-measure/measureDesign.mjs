import {openHarness} from './openHarness.mjs';
// Numeric DOM/style checks only. Captures remain manager-owned.
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const column=Number(process.argv[3]??800);
const css=readFileSync(new URL('../../src/blockeditor/canvas/canvas.css',import.meta.url),'utf8');
const hexCount=source=>(source.match(/#[\da-f]{3,8}\b/gi)||[]).length;
const result={method:`Native Chromium computed styles and geometry, light/dark app tokens, ${column} CSS-pixel canvas. No captures. Hex meter scans canvas chrome stylesheet; literal content ink/paper/swatches are document color values, not chrome tokens.`,colorTokens:{observedHex:hexCount(css),negativeControlHex:hexCount(css+'\n.ob-canvas-title { color:#123456; }')},themes:[]};
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:1000},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openHarness(page);await page.getByRole('region').waitFor();await page.evaluate(()=>document.fonts.ready);await page.evaluate(column=>window.canvasEvidence.column(column),column);
 for(const theme of ['light','dark']){
  await page.evaluate(theme=>{document.documentElement.classList.toggle('dark',theme==='dark');window.canvasEvidence.reset(0);},theme);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.getByRole('region').focus();await page.keyboard.press('Enter');await page.getByLabel('Stroke color value').waitFor();
  const pressed=await page.evaluate(()=>{
   const pressed=document.querySelector('.ob-canvas-tools [aria-pressed=true]'),surface=document.querySelector('.ob-canvas'),button=getComputedStyle(pressed),root=getComputedStyle(surface);
   const lum=color=>{const v=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2];};
   const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
   const boundary=document.querySelector('.ob-canvas input'),field=getComputedStyle(boundary);
   return {background:root.backgroundColor,foreground:root.color,pressedFill:button.backgroundColor,pressedIcon:button.color,pressedBoundaryContrast:ratio(button.backgroundColor,root.backgroundColor),pressedIconContrast:ratio(button.color,button.backgroundColor),nonColorMarker:getComputedStyle(pressed,'::after').height,fieldBoundaryContrast:ratio(field.borderTopColor,field.backgroundColor),textContrast:ratio(root.color,root.backgroundColor)};
  });
  await page.getByRole('region').focus();await page.keyboard.press('Tab');
  const focus=await page.evaluate(()=>{const el=document.activeElement,s=getComputedStyle(el),r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();return {visible:el.matches(':focus-visible'),outline:s.outlineStyle,width:s.outlineWidth,offset:s.outlineOffset,contained:r.left>=parent.left&&r.right<=parent.right&&r.top>=parent.top&&r.bottom<=parent.bottom};});
  await page.getByLabel('Drawing viewport').focus();await page.keyboard.press('r');await page.keyboard.press('Enter');
  const selection=await page.evaluate(()=>{const root=document.querySelector('.ob-canvas'),r=root.getBoundingClientRect(),properties=root.querySelector('.ob-canvas-properties');const clipped=()=>[...properties.querySelectorAll('input,select,button')].filter(el=>{const b=el.getBoundingClientRect();return b.left<r.left||b.right>r.right;}).map(el=>el.getAttribute('aria-label')||el.textContent);const observed=clipped(),overflow=properties.scrollWidth>properties.clientWidth,field=properties.querySelector('input');field.style.transform='translateX(1000px)';const negativeControl=clipped();field.style.transform='';return {width:r.width,overflow,clipped:observed,negativeControl,padding:getComputedStyle(properties).padding,undoInHeader:!!root.querySelector('.ob-canvas-header [aria-label="Undo rectangle"]')};});
  await page.getByRole('button',{name:'Help (?)',exact:true}).click();
  const popover=await page.evaluate(()=>{const panel=document.querySelector('.ob-canvas-help'),trigger=panel.parentElement.querySelector('button'),p=panel.getBoundingClientRect(),t=trigger.getBoundingClientRect();return {gap:p.top-t.bottom,helpTarget:{width:t.width,height:t.height},sameAnchor:panel.parentElement===trigger.parentElement};});
  await page.getByRole('button',{name:'Close help',exact:true}).click();
  const restraint=await page.evaluate(()=>{
   const root=document.querySelector('.ob-canvas'),pixel=document.createElement('canvas');pixel.width=pixel.height=1;const ctx=pixel.getContext('2d');
   const count=()=>{let opacityDerivedTextColors=0;for(const el of root.querySelectorAll('*'))if([...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())){ctx.clearRect(0,0,1,1);ctx.fillStyle=getComputedStyle(el).color;ctx.fillRect(0,0,1,1);if(ctx.getImageData(0,0,1,1).data[3]<255)opacityDerivedTextColors++;}return opacityDerivedTextColors;};
   const observed=count(),title=root.querySelector('.ob-canvas-title');title.style.color='rgba(0,0,0,.4)';const negativeControl=count(),plantedColor=getComputedStyle(title).color,elementOpacity=getComputedStyle(title).opacity;title.style.color='';return {observed,negativeControl,plantedColor,elementOpacity};
  });
  await page.evaluate(()=>{document.activeElement.blur();});
  const inactive=await page.evaluate(()=>({properties:!!document.querySelector('.ob-canvas-properties'),viewControls:!!document.querySelector('.ob-canvas-footer'),heightGrip:!!document.querySelector('.ob-canvas-height')}));
  result.themes.push({theme,pressed,focus,selection,popover,restraint,inactive});
 }
 result.browserErrors=errors;
 writeFileSync(fileURLToPath(new URL(process.argv[2]??'../../../../_evidence-build4/design-polish.json',import.meta.url)),JSON.stringify(result,null,2)+'\n');
 if(errors.length||result.colorTokens.observedHex!==0||result.colorTokens.negativeControlHex!==1||result.themes.some(r=>r.pressed.pressedBoundaryContrast<3||r.pressed.pressedIconContrast<3||r.pressed.fieldBoundaryContrast<3||r.pressed.textContrast<4.5||r.pressed.nonColorMarker!=='2px'||!r.focus.visible||!r.focus.contained||parseFloat(r.focus.offset)>=0||r.selection.width!==column||r.selection.overflow||r.selection.clipped.length||r.selection.negativeControl.length!==1||!r.selection.undoInHeader||r.popover.helpTarget.width<28||r.popover.helpTarget.height<28||r.popover.gap!==4||r.restraint.observed!==0||r.restraint.negativeControl!==1||Object.values(r.inactive).some(Boolean)))throw new Error('Design polish assertion failed; inspect design-polish.json');
 console.log(JSON.stringify(result,null,2));
} finally {await browser.close();}
