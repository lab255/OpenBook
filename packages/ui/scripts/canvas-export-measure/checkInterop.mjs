/* global window, document, ClipboardItem, Node */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const origin=process.env.BUILD6_ORIGIN??'http://127.0.0.1:5186';
const require=createRequire(new URL('../../../web/package.json',import.meta.url)),{chromium}=require('@playwright/test');
const uiRequire=createRequire(new URL('../../package.json',import.meta.url)),{unzipSync,strFromU8}=uiRequire('fflate');
const sdkRequire=createRequire(new URL('../../../sdk/package.json',import.meta.url)),{marked}=sdkRequire('marked');
const output=process.env.BUILD6_INTEROP_OUTPUT;
assert(output,'BUILD6_INTEROP_OUTPUT required');
const browser=await chromium.launch({headless:true,args:['--single-process','--no-zygote']});
try {
 const page=await browser.newPage({viewport:{width:1100,height:900},permissions:['clipboard-read','clipboard-write']});
 await page.goto(`${origin}/`);await page.waitForFunction(()=>window.canvasInterop);
 const result=await page.evaluate(async()=>{
  const boxes=[],rasters=[],append=Node.prototype.appendChild;
  Node.prototype.appendChild=function(node){
   if(node.nodeName.toLowerCase()==='svg'&&node.hasAttribute('viewBox')) {
    const frame=Array.from(document.querySelectorAll('iframe')).find(f=>f.contentDocument?.querySelector('[data-canvas-fallback] img'));
    if(frame){const doc=frame.contentDocument;rasters.push(doc.querySelector('[data-canvas-fallback] img').src);boxes.push({main:doc.querySelector('main').getBoundingClientRect().toJSON(),image:doc.querySelector('[data-canvas-fallback] img').getBoundingClientRect().toJSON(),viewport:doc.querySelector('[data-canvas-fallback]').getBoundingClientRect().toJSON()});}
   }
   return append.call(this,node);
  };
  try{return {...await window.canvasInterop(),pdfBoxes:boxes,pdfRasters:rasters};}finally{Node.prototype.appendChild=append;}
 });
 assert.equal(result.pdfBoxes.length,2,'One measured HTML image box per PDF mode');
 assert.equal(result.pdfRasters[0],result.pdfRasters[1]);
 const pdfRaster=Buffer.from(result.pdfRasters[0].split(',')[1],'base64');writeFileSync(`${output}.pdf-reference.png`,pdfRaster);
 for(const [path,hash] of Object.entries(result.stamp))assert.equal(createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex'),hash,'Interop harness source drift');
 for(const [mode,data] of Object.entries(result.pdfs)){const bytes=Buffer.from(data,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');writeFileSync(`${output}.${mode}.pdf`,bytes);}
 const files=unzipSync(Buffer.from(result.zip,'base64')),markdown=strFromU8(files['document.md']);
 for(const [name,data] of Object.entries(files)){assert(!name.includes('..'));const target=new URL(`./dist/markdown/${name}`,import.meta.url);mkdirSync(new URL('.',target),{recursive:true});writeFileSync(target,data);}
 writeFileSync(new URL('./dist/markdown/index.html',import.meta.url),`<!doctype html><meta charset="utf-8"><title>Marked canvas package</title>${marked.parse(markdown)}`);
 writeFileSync(`${output}.reference.png`,files['assets/canvas-0.png']);
 await page.goto(`${origin}/markdown/index.html`);
 const markdownRead=await page.evaluate(async()=>{const image=document.querySelector('img');if(!image)throw new Error('Markdown reader omitted image');await image.decode();return {src:image.getAttribute('src'),width:image.naturalWidth,height:image.naturalHeight,alt:image.alt,text:document.body.textContent};});
 assert.equal(markdownRead.src,'assets/canvas-0.png');assert.equal(markdownRead.width,624);assert.equal(markdownRead.height,360);assert(markdownRead.text.includes('Export text'));assert(markdownRead.text.includes('Before the drawing'));
 const imageHash=await page.locator('img').evaluate(async image=>{const bytes=await (await fetch(image.src)).arrayBuffer();return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('');});
 assert.equal(imageHash,createHash('sha256').update(files['assets/canvas-0.png']).digest('hex'));
 await page.evaluate(async html=>{document.body.innerHTML='<div contenteditable="true" id="paste" aria-label="Clipboard receiver"></div>';await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob(['Drawing clipboard text alternative'],{type:'text/plain'})})]);},result.clipboard);
 await page.locator('#paste').focus();await page.keyboard.press(process.platform==='darwin'?'Meta+V':'Control+V');
 await page.waitForSelector('#paste img');
 const clipboardRead=await page.locator('#paste').evaluate(async root=>{const image=root.querySelector('img');await image.decode();return {width:image.naturalWidth,height:image.naturalHeight,src:image.src,alt:image.alt,text:root.textContent};});
 assert.equal(clipboardRead.width,624);assert.equal(clipboardRead.height,360);assert(clipboardRead.text.includes('Export text'));assert(clipboardRead.text.includes('After the drawing'));
 assert.equal(createHash('sha256').update(Buffer.from(clipboardRead.src.split(',')[1],'base64')).digest('hex'),imageHash);
 await page.locator('#paste img').evaluate(image=>image.remove());assert.equal(await page.locator('#paste img').count(),0,'Missing-image control');
 const report={scope:'Real toPdf paged/continuous; Marked 18 package reader in Chromium, relative PNG decode and byte identity; native paste from HTML ClipboardItem into Chromium contenteditable, PNG decode/identity and text. Not every external reader/editor.',stamp:result.stamp,pdfModes:Object.keys(result.pdfs),pdfBoxes:result.pdfBoxes,pdfRasterBytes:pdfRaster.length,htmlRasterBytes:files['assets/canvas-0.png'].length,markdownRead,clipboardRead:{...clipboardRead,src:'omitted; PNG hash asserted'},imageHash,missingImageControl:true};
 writeFileSync(output,JSON.stringify(report,null,2));assert.deepEqual(JSON.parse(readFileSync(output,'utf8')),report);console.log('PDF files emitted; packaged Markdown and native clipboard HTML interoperability PASS.');
}finally{await browser.close();}
